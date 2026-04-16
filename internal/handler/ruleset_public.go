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
	name := strings.TrimSpace(c.Param("name"))
	if token == "" {
		Fail(c, http.StatusBadRequest, "无效的 token")
		return
	}
	if name == "" {
		Fail(c, http.StatusBadRequest, "无效的名称")
		return
	}

	var rs model.HostedRuleSet
	if err := repository.DB.Where("token = ?", token).First(&rs).Error; err != nil {
		Fail(c, http.StatusNotFound, "规则集不存在")
		return
	}
	if rs.Name != name {
		Fail(c, http.StatusNotFound, "规则集不存在")
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
		contentType = "text/yaml; charset=utf-8"
	}
	c.Data(http.StatusOK, contentType, []byte(rs.Content))
}
