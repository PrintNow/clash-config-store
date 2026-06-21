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

// providerRequest 统一创建/更新请求体
type providerRequest struct {
	Name    string             `json:"name" binding:"required"`
	Type    model.ProviderType `json:"type"` // 默认 http

	// http 类型字段
	URL           string `json:"url"`
	UserAgentID   *uint  `json:"user_agent_id"`
	CacheTTL      *int   `json:"cache_ttl"`
	Filter        string `json:"filter"`
	ExcludeFilter string `json:"exclude_filter"`
	Prefix        string `json:"prefix"`
	Suffix        string `json:"suffix"`

	// inline 类型字段
	Payload model.JSONPayload `json:"payload"`
}

// CreateProvider 同时支持 http 和 inline
func CreateProvider(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var req providerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}
	if req.Type == "" {
		req.Type = model.ProviderTypeHTTP
	}
	if req.Type == model.ProviderTypeHTTP && req.URL == "" {
		Fail(c, http.StatusBadRequest, "http 类型必须提供 url")
		return
	}
	if req.UserAgentID != nil && !userAgentSelectableByUser(userID, *req.UserAgentID) {
		Fail(c, http.StatusBadRequest, "无效的 user_agent_id")
		return
	}
	cacheTTL := 3600
	if req.CacheTTL != nil {
		cacheTTL = *req.CacheTTL
	}
	p := &model.Provider{
		UserID:        userID,
		Name:          req.Name,
		Type:          req.Type,
		URL:           req.URL,
		UserAgentID:   req.UserAgentID,
		CacheTTL:      cacheTTL,
		Filter:        req.Filter,
		ExcludeFilter: req.ExcludeFilter,
		Prefix:        req.Prefix,
		Suffix:        req.Suffix,
		Payload:       req.Payload,
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

	if req.Type == "" {
		req.Type = p.Type
	}
	if req.Type == model.ProviderTypeHTTP && req.URL == "" {
		Fail(c, http.StatusBadRequest, "http 类型必须提供 url")
		return
	}
	if req.UserAgentID != nil && !userAgentSelectableByUser(userID, *req.UserAgentID) {
		Fail(c, http.StatusBadRequest, "无效的 user_agent_id")
		return
	}

	p.Name = req.Name
	p.Type = req.Type
	p.URL = req.URL
	p.UserAgentID = req.UserAgentID
	p.Filter = req.Filter
	p.ExcludeFilter = req.ExcludeFilter
	p.Prefix = req.Prefix
	p.Suffix = req.Suffix
	p.Payload = req.Payload
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

	if p.Type == model.ProviderTypeInline {
		OKMsg(c, "inline provider 无需刷新", p)
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

// --- inline provider 节点 CRUD ---

// GetProviderNodes 获取 inline provider 节点列表
func GetProviderNodes(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var p model.Provider
	if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&p).Error; err != nil {
		Fail(c, http.StatusNotFound, "Provider 不存在")
		return
	}
	if p.Type != model.ProviderTypeInline {
		Fail(c, http.StatusBadRequest, "仅 inline provider 支持节点管理")
		return
	}
	if p.Payload == nil {
		p.Payload = model.JSONPayload{}
	}
	OK(c, p.Payload)
}

// AddProviderNode 向 inline provider 添加节点
func AddProviderNode(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	var p model.Provider
	if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&p).Error; err != nil {
		Fail(c, http.StatusNotFound, "Provider 不存在")
		return
	}
	if p.Type != model.ProviderTypeInline {
		Fail(c, http.StatusBadRequest, "仅 inline provider 支持节点管理")
		return
	}
	var node map[string]interface{}
	if err := c.ShouldBindJSON(&node); err != nil {
		BindFail(c, err)
		return
	}
	p.Payload = append(p.Payload, node)
	if err := repository.DB.Save(&p).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "保存失败")
		return
	}
	OK(c, p.Payload)
}

// UpdateProviderNode 更新指定索引的节点
func UpdateProviderNode(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	nodeIdx, err := strconv.Atoi(c.Param("nodeIndex"))
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的节点索引")
		return
	}
	var p model.Provider
	if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&p).Error; err != nil {
		Fail(c, http.StatusNotFound, "Provider 不存在")
		return
	}
	if p.Type != model.ProviderTypeInline {
		Fail(c, http.StatusBadRequest, "仅 inline provider 支持节点管理")
		return
	}
	if nodeIdx < 0 || nodeIdx >= len(p.Payload) {
		Fail(c, http.StatusBadRequest, "节点索引越界")
		return
	}
	var node map[string]interface{}
	if err := c.ShouldBindJSON(&node); err != nil {
		BindFail(c, err)
		return
	}
	p.Payload[nodeIdx] = node
	if err := repository.DB.Save(&p).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "保存失败")
		return
	}
	OK(c, p.Payload)
}

// DeleteProviderNode 删除指定索引的节点
func DeleteProviderNode(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, _ := strconv.ParseUint(c.Param("id"), 10, 64)
	nodeIdx, err := strconv.Atoi(c.Param("nodeIndex"))
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的节点索引")
		return
	}
	var p model.Provider
	if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&p).Error; err != nil {
		Fail(c, http.StatusNotFound, "Provider 不存在")
		return
	}
	if p.Type != model.ProviderTypeInline {
		Fail(c, http.StatusBadRequest, "仅 inline provider 支持节点管理")
		return
	}
	if nodeIdx < 0 || nodeIdx >= len(p.Payload) {
		Fail(c, http.StatusBadRequest, "节点索引越界")
		return
	}
	p.Payload = append(p.Payload[:nodeIdx], p.Payload[nodeIdx+1:]...)
	if err := repository.DB.Save(&p).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "保存失败")
		return
	}
	OK(c, p.Payload)
}
