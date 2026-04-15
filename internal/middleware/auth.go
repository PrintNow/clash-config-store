package middleware

import (
	"net/http"
	"strings"

	"clash-config-store/internal/util"

	"github.com/gin-gonic/gin"
)

// Auth JWT 认证中间件，从 Authorization: Bearer <token> 中解析并验证 token
func Auth() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"code":    -1,
				"message": "未提供认证 token",
			})
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		claims, err := util.ParseToken(tokenStr)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"code":    -1,
				"message": "无效或过期的 token",
			})
			return
		}

		c.Set("userID", claims.UserID)
		c.Set("email", claims.Email)
		c.Next()
	}
}

// CurrentUserID 从 gin 上下文中获取当前已认证用户的 ID
func CurrentUserID(c *gin.Context) uint {
	userID, _ := c.Get("userID")
	id, _ := userID.(uint)
	return id
}
