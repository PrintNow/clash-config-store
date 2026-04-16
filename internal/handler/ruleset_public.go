package handler

import (
	"net/http"
	"strings"

	"clash-config-store/internal/model"
	"clash-config-store/internal/repository"

	"github.com/gin-gonic/gin"
)

func HandleRuleSet(c *gin.Context) {
	token := strings.TrimSpace(c.Param("token"))
	if token == "" {
		Fail(c, http.StatusBadRequest, "无效的 token")
		return
	}

	var rs model.HostedRuleSet
	if err := repository.DB.Where("share_token = ?", token).First(&rs).Error; err != nil {
		Fail(c, http.StatusNotFound, "规则集不存在")
		return
	}
	if !rs.ShareEnabled {
		Fail(c, http.StatusForbidden, "规则集未开启分享")
		return
	}

	etag := `"` + rs.ContentSHA256 + `"`
	if inm := c.GetHeader("If-None-Match"); inm != "" && inm == etag {
		c.Status(http.StatusNotModified)
		return
	}
	c.Header("ETag", etag)

	contentType := "text/plain; charset=utf-8"
	if rs.Format == "yaml" {
		contentType = "application/x-yaml; charset=utf-8"
	}
	c.Data(http.StatusOK, contentType, []byte(rs.Content))
}

