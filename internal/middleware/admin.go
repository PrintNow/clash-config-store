package middleware

import (
	"net/http"

	"clash-config-store/internal/model"
	"clash-config-store/internal/repository"

	"github.com/gin-gonic/gin"
)

// AdminRequired 需已登录且角色为 root 或 admin
func AdminRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		uid := CurrentUserID(c)
		if uid == 0 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": -1, "message": "未认证"})
			return
		}
		var u model.User
		if err := repository.DB.First(&u, uid).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"code": -1, "message": "无权访问"})
			return
		}
		if u.Role != model.RoleRoot && u.Role != model.RoleAdmin {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"code": -1, "message": "需要管理员权限"})
			return
		}
		c.Set("userRole", u.Role)
		c.Next()
	}
}

// RootRequired 需已登录且为超级管理员
func RootRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		uid := CurrentUserID(c)
		if uid == 0 {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": -1, "message": "未认证"})
			return
		}
		var u model.User
		if err := repository.DB.First(&u, uid).Error; err != nil {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"code": -1, "message": "无权访问"})
			return
		}
		if u.Role != model.RoleRoot {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"code": -1, "message": "需要超级管理员权限"})
			return
		}
		c.Next()
	}
}
