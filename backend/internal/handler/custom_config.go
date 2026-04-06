package handler

import (
	"net/http"
	"strconv"

	"clash-config-store/internal/middleware"
	"clash-config-store/internal/model"
	"clash-config-store/internal/repository"

	"github.com/gin-gonic/gin"
)

// ListCustomConfigs 列出当前用户所有自定义配置
func ListCustomConfigs(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var configs []model.CustomConfig
	if err := repository.DB.Where("user_id = ?", userID).Find(&configs).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "查询失败")
		return
	}
	OK(c, configs)
}

type customConfigRequest struct {
	Name        string `json:"name" binding:"required"`
	Proxies     string `json:"proxies"`
	ProxyGroups string `json:"proxy_groups"`
	Rules       string `json:"rules"`
}

// CreateCustomConfig 创建自定义配置
func CreateCustomConfig(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var req customConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}

	cfg := &model.CustomConfig{
		UserID:      userID,
		Name:        req.Name,
		Proxies:     req.Proxies,
		ProxyGroups: req.ProxyGroups,
		Rules:       req.Rules,
	}

	if err := repository.DB.Create(cfg).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "创建失败")
		return
	}

	OK(c, cfg)
}

// GetCustomConfig 获取自定义配置详情（仅限自己的数据）
func GetCustomConfig(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var cfg model.CustomConfig
	if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&cfg).Error; err != nil {
		Fail(c, http.StatusNotFound, "配置不存在或无权限")
		return
	}

	OK(c, cfg)
}

// UpdateCustomConfig 更新自定义配置（仅限自己的数据）
func UpdateCustomConfig(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var cfg model.CustomConfig
	if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&cfg).Error; err != nil {
		Fail(c, http.StatusNotFound, "配置不存在或无权限")
		return
	}

	var req customConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}

	cfg.Name = req.Name
	cfg.Proxies = req.Proxies
	cfg.ProxyGroups = req.ProxyGroups
	cfg.Rules = req.Rules

	if err := repository.DB.Save(&cfg).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "更新失败")
		return
	}

	OK(c, cfg)
}

// DeleteCustomConfig 删除自定义配置（仅限自己的数据）
func DeleteCustomConfig(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var cfg model.CustomConfig
	if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&cfg).Error; err != nil {
		Fail(c, http.StatusNotFound, "配置不存在或无权限")
		return
	}

	if err := repository.DB.Delete(&cfg).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "删除失败")
		return
	}

	OKMsg(c, "删除成功", nil)
}
