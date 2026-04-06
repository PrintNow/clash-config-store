package handler

import (
	"fmt"
	"net"
	"net/http"
	"strings"

	"clash-config-store/internal/model"
	"clash-config-store/internal/repository"
	"clash-config-store/internal/service"
	"clash-config-store/internal/util"

	"github.com/gin-gonic/gin"
)

// HandleSub 处理公开订阅端点 GET /sub/:token
func HandleSub(c *gin.Context) {
	token := c.Param("token")
	clientIP := getRealIP(c)

	yamlBytes, subID, allowed, denyReason, err := service.GenerateYAML(token, clientIP)

	// 异步写入访问日志（不阻塞响应）
	go func() {
		if subID == 0 {
			return
		}
		geoInfo := util.LookupIP(clientIP)
		logEntry := &model.AccessLog{
			SubscriptionID: subID,
			IP:             clientIP,
			Country:        geoInfo.Country,
			CountryCode:    geoInfo.CountryCode,
			City:           geoInfo.City,
			Allowed:        allowed,
			DenyReason:     denyReason,
		}
		repository.DB.Create(logEntry)
	}()

	if err != nil {
		c.String(http.StatusInternalServerError, "内部错误: %v", err)
		return
	}

	if !allowed {
		c.String(http.StatusForbidden, "访问被拒绝: %s", denyReason)
		return
	}

	// 统计代理节点数量，附加 Subscription-Userinfo header（供客户端展示）
	proxyCount := countProxiesInYAML(yamlBytes)
	if proxyCount > 0 {
		c.Header("Subscription-Userinfo", fmt.Sprintf("total=%d; upload=0; download=0; expire=0", proxyCount))
	}

	c.Data(http.StatusOK, "text/yaml; charset=utf-8", yamlBytes)
}

// getRealIP 从请求头或 RemoteAddr 中提取真实客户端 IP
func getRealIP(c *gin.Context) string {
	if ip := c.GetHeader("X-Real-IP"); ip != "" {
		return strings.TrimSpace(ip)
	}
	if xff := c.GetHeader("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}
	ip, _, err := net.SplitHostPort(c.Request.RemoteAddr)
	if err != nil {
		return c.Request.RemoteAddr
	}
	return ip
}

// countProxiesInYAML 统计 YAML 配置中的代理节点数量（按 proxies 列表项计数）
func countProxiesInYAML(data []byte) int {
	count := 0
	lines := strings.Split(string(data), "\n")
	inProxies := false
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "proxies:" {
			inProxies = true
			continue
		}
		if inProxies {
			// 代理节点以 "- name:" 或行内格式 "- {name:" 开头
			if strings.HasPrefix(trimmed, "- name:") || strings.HasPrefix(trimmed, "- {name:") {
				count++
			} else if len(trimmed) > 0 &&
				!strings.HasPrefix(trimmed, "-") &&
				!strings.HasPrefix(trimmed, "#") &&
				strings.Contains(trimmed, ":") &&
				!strings.HasPrefix(line, " ") &&
				!strings.HasPrefix(line, "\t") {
				// 遇到新的顶层 key，退出 proxies 区域
				inProxies = false
			}
		}
	}
	return count
}
