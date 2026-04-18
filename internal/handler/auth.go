package handler

import (
	"encoding/base64"
	"net/http"

	"clash-config-store/internal/service"
	"clash-config-store/internal/util"

	"github.com/gin-gonic/gin"
)

type registerRequest struct {
	Email             string `json:"email" binding:"required,email"`
	Name              string `json:"name" binding:"required"`
	EncryptedPassword string `json:"encrypted_password" binding:"required"`
}

type loginRequest struct {
	Email             string `json:"email" binding:"required,email"`
	EncryptedPassword string `json:"encrypted_password" binding:"required"`
}

// GetPublicKey 返回 RSA 公钥及过期时间，前端加密密码时使用
func GetPublicKey(c *gin.Context) {
	pubPEM, expiresAt, err := util.GetRSAPublicKey()
	if err != nil {
		Fail(c, http.StatusInternalServerError, "获取公钥失败")
		return
	}
	OK(c, gin.H{
		"public_key": pubPEM,
		"expires_at": expiresAt.Unix(),
	})
}

// Register 注册新用户
func Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}

	password, err := decryptPassword(req.EncryptedPassword)
	if err != nil {
		Fail(c, http.StatusBadRequest, "密码解密失败，请刷新页面重试")
		return
	}

	token, user, err := service.Register(req.Email, req.Name, password)
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

	password, err := decryptPassword(req.EncryptedPassword)
	if err != nil {
		Fail(c, http.StatusBadRequest, "密码解密失败，请刷新页面重试")
		return
	}

	token, user, err := service.Login(req.Email, password)
	if err != nil {
		Fail(c, http.StatusUnauthorized, err.Error())
		return
	}

	OK(c, gin.H{"token": token, "user": user})
}

// decryptPassword base64 解码后用 RSA 私钥解密
func decryptPassword(encryptedB64 string) (string, error) {
	ciphertext, err := base64.StdEncoding.DecodeString(encryptedB64)
	if err != nil {
		return "", err
	}
	plainBytes, err := util.RSADecrypt(ciphertext)
	if err != nil {
		return "", err
	}
	return string(plainBytes), nil
}
