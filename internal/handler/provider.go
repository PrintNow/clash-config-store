package handler

import (
	"net/http"
	"strconv"

	"clash-config-store/internal/middleware"
	"clash-config-store/internal/model"
	"clash-config-store/internal/repository"
	"clash-config-store/internal/service"

	"github.com/gin-gonic/gin"
)

// userAgentSelectableByUser 校验 UA 可被当前用户用于 Provider（本人或全局预设）
func userAgentSelectableByUser(userID uint, uaID uint) bool {
	var ua model.UserAgent
	if err := repository.DB.First(&ua, uaID).Error; err != nil {
		return false
	}
	if ua.IsPreset {
		return true
	}
	return ua.UserID != nil && *ua.UserID == userID
}

// ListProviders 列出当前用户的所有 Provider（含 UserAgent 信息）
func ListProviders(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var providers []model.Provider
	if err := repository.DB.Preload("UserAgent").Where("user_id = ?", userID).Find(&providers).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "查询失败")
		return
	}
	OK(c, providers)
}

type providerRequest struct {
	Name        string  `json:"name" binding:"required"`
	URL         string  `json:"url" binding:"required,url"`
	UserAgentID *uint   `json:"user_agent_id"`
	CacheTTL    *int    `json:"cache_ttl"`
}

// CreateProvider 创建 Provider
func CreateProvider(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var req providerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}

	cacheTTL := 60
	if req.CacheTTL != nil {
		cacheTTL = *req.CacheTTL
	}

	if req.UserAgentID != nil && !userAgentSelectableByUser(userID, *req.UserAgentID) {
		Fail(c, http.StatusBadRequest, "无效的 user_agent_id")
		return
	}

	p := &model.Provider{
		UserID:      userID,
		Name:        req.Name,
		URL:         req.URL,
		UserAgentID: req.UserAgentID,
		CacheTTL:    cacheTTL,
	}

	if err := repository.DB.Create(p).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "创建失败")
		return
	}

	OK(c, p)
}

// UpdateProvider 更新指定 Provider（仅限自己的数据）
func UpdateProvider(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var p model.Provider
	if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&p).Error; err != nil {
		Fail(c, http.StatusNotFound, "Provider 不存在或无权限")
		return
	}

	var req providerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}

	if req.UserAgentID != nil && !userAgentSelectableByUser(userID, *req.UserAgentID) {
		Fail(c, http.StatusBadRequest, "无效的 user_agent_id")
		return
	}

	p.Name = req.Name
	p.URL = req.URL
	p.UserAgentID = req.UserAgentID
	if req.CacheTTL != nil {
		p.CacheTTL = *req.CacheTTL
	}

	if err := repository.DB.Save(&p).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "更新失败")
		return
	}

	OK(c, p)
}

// DeleteProvider 删除指定 Provider（仅限自己的数据）
func DeleteProvider(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var p model.Provider
	if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&p).Error; err != nil {
		Fail(c, http.StatusNotFound, "Provider 不存在或无权限")
		return
	}

	if err := repository.DB.Delete(&p).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "删除失败")
		return
	}

	OKMsg(c, "删除成功", nil)
}

// RefreshProvider 立即同步拉取并刷新 Provider 缓存
func RefreshProvider(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var p model.Provider
	if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&p).Error; err != nil {
		Fail(c, http.StatusNotFound, "Provider 不存在或无权限")
		return
	}

	if err := service.FetchAndCache(uint(id)); err != nil {
		Fail(c, http.StatusInternalServerError, "刷新失败: "+err.Error())
		return
	}

	// 重新查询返回最新数据
	repository.DB.Preload("UserAgent").First(&p, id)
	OKMsg(c, "刷新成功", p)
}
