package handler

import (
	"net/http"

	"clash-config-store/internal/middleware"
	"clash-config-store/internal/model"
	"clash-config-store/internal/repository"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// GetProfile 获取当前用户信息
func GetProfile(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var user model.User
	if err := repository.DB.First(&user, userID).Error; err != nil {
		Fail(c, http.StatusNotFound, "用户不存在")
		return
	}
	OK(c, user)
}

type updateProfileRequest struct {
	Name  string `json:"name"`
	Email string `json:"email" binding:"omitempty,email"`
}

// UpdateProfile 更新用户名和邮箱
func UpdateProfile(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var req updateProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}

	var user model.User
	if err := repository.DB.First(&user, userID).Error; err != nil {
		Fail(c, http.StatusNotFound, "用户不存在")
		return
	}

	// 邮箱唯一性检查
	if req.Email != "" && req.Email != user.Email {
		var count int64
		repository.DB.Model(&model.User{}).
			Where("email = ? AND id != ?", req.Email, userID).
			Count(&count)
		if count > 0 {
			Fail(c, http.StatusBadRequest, "该邮箱已被使用")
			return
		}
		user.Email = req.Email
	}

	if req.Name != "" {
		user.Name = req.Name
	}

	if err := repository.DB.Save(&user).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "更新失败")
		return
	}

	OK(c, user)
}

type updatePasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=6"`
}

// UpdatePassword 修改当前用户密码
func UpdatePassword(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var req updatePasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}

	var user model.User
	if err := repository.DB.First(&user, userID).Error; err != nil {
		Fail(c, http.StatusNotFound, "用户不存在")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.OldPassword)); err != nil {
		Fail(c, http.StatusBadRequest, "旧密码错误")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		Fail(c, http.StatusInternalServerError, "密码加密失败")
		return
	}

	if err := repository.DB.Model(&user).Update("password_hash", string(hash)).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "更新失败")
		return
	}

	OKMsg(c, "密码已更新", nil)
}
