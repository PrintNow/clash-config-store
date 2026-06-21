package handler

import (
	"crypto/sha256"
	"fmt"
	"net/http"
	"time"

	"clash-config-store/internal/model"
	"clash-config-store/internal/repository"
	"clash-config-store/internal/service"

	"github.com/gin-gonic/gin"
)

// HandleRuleProviderCache 公开接口，供 Clash 拉取服务器缓存的外部规则集内容
// GET /rule-cache/:token
func HandleRuleProviderCache(c *gin.Context) {
	token := c.Param("token")

	var rp model.RuleProvider
	if err := repository.DB.Where("cache_token = ?", token).First(&rp).Error; err != nil {
		c.Status(http.StatusNotFound)
		return
	}

	if !rp.ServerCacheEnabled {
		c.Status(http.StatusForbidden)
		return
	}

	// 缓存为空或已过期：同步拉取
	if rp.CachedContent == "" || (rp.CacheExpiresAt != nil && time.Now().After(*rp.CacheExpiresAt)) {
		if err := service.FetchAndCacheRuleProvider(rp.ID); err != nil {
			if rp.CachedContent == "" {
				c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("拉取上游失败: %v", err)})
				return
			}
			// 拉取失败但仍有旧缓存，继续返回旧缓存
		} else {
			// 重新加载最新缓存
			_ = repository.DB.First(&rp, rp.ID).Error
		}
	}

	sum := sha256.Sum256([]byte(rp.CachedContent))
	etag := fmt.Sprintf(`"%x"`, sum)
	if c.GetHeader("If-None-Match") == etag {
		c.Status(http.StatusNotModified)
		return
	}

	contentType := "text/yaml; charset=utf-8"
	if rp.Format == "text" {
		contentType = "text/plain; charset=utf-8"
	}

	c.Header("ETag", etag)
	c.Data(http.StatusOK, contentType, []byte(rp.CachedContent))
}
