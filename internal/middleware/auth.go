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

// CurrentUserID 从 gin 上下文中获取当前已认证用户的 ID。
// 仅在 Auth() 中间件已运行的 handler 中调用；若上下文中无 userID 则返回 0。
func CurrentUserID(c *gin.Context) uint {
	val, exists := c.Get("userID")
	if !exists {
		return 0
	}
	id, ok := val.(uint)
	if !ok {
		return 0
	}
	return id
}

// RequireCurrentUserID 与 CurrentUserID 相同，但在 userID == 0 时
// 直接 Abort 401 并返回 false，供新 handler 主动防御使用。
// 现有 handler 无需迁移；新增 handler 建议使用此函数。
func RequireCurrentUserID(c *gin.Context) (uint, bool) {
	id := CurrentUserID(c)
	if id == 0 {
		c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
			"code":    -1,
			"message": "未认证",
		})
		return 0, false
	}
	return id, true
}
