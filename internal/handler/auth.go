package handler

import (
	"net/http"

	"clash-config-store/internal/service"

	"github.com/gin-gonic/gin"
)

type registerRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Name     string `json:"name" binding:"required"`
	Password string `json:"password" binding:"required,min=6"`
}

type loginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// Register 注册新用户
func Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}

	token, user, err := service.Register(req.Email, req.Name, req.Password)
	if err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	OK(c, gin.H{"token": token, "user": user})
}

// Login 用户登录
func Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}

	token, user, err := service.Login(req.Email, req.Password)
	if err != nil {
		Fail(c, http.StatusUnauthorized, err.Error())
		return
	}

	OK(c, gin.H{"token": token, "user": user})
}
