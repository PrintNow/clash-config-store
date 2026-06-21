package middleware

import (
	"net/http"

	"clash-config-store/internal/model"
	"clash-config-store/internal/repository"

	"github.com/gin-gonic/gin"
)

// Admin 管理员权限中间件，需在 Auth 中间件之后使用
func Admin() gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := CurrentUserID(c)
		var user model.User
		if err := repository.DB.First(&user, userID).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"code":    -1,
				"message": "权限不足",
			})
			return
		}
		if !user.IsAdmin {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
				"code":    -1,
				"message": "权限不足",
			})
			return
		}
		c.Next()
	}
}
