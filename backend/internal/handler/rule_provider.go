package handler

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"clash-config-store/internal/middleware"
	"clash-config-store/internal/model"
	"clash-config-store/internal/repository"

	"github.com/gin-gonic/gin"
)

type ruleProviderRequest struct {
	Name     string `json:"name" binding:"required"`
	Type     string `json:"type" binding:"required"`
	URL      string `json:"url"`
	Behavior string `json:"behavior" binding:"required"`
	Format   string `json:"format"`
	Interval int    `json:"interval"`
}

// ListRuleProviders 列出当前用户的规则集 + 系统内置预设（is_preset=true）
func ListRuleProviders(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var providers []model.RuleProvider
	// 返回自己的 + 系统预设（预设 user_id 为 NULL，用 is_preset 识别）
	if err := repository.DB.Where("user_id = ? OR is_preset = ?", userID, true).
		Order("is_preset DESC, id ASC").
		Find(&providers).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "查询失败")
		return
	}
	OK(c, providers)
}

// CreateRuleProvider 创建自定义规则集条目
func CreateRuleProvider(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var req ruleProviderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}

	if err := validateRuleProviderRequest(&req); err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	interval := req.Interval
	if interval <= 0 {
		interval = 86400
	}
	format := req.Format
	if format == "" {
		format = "yaml"
	}

	uid := userID
	rp := &model.RuleProvider{
		UserID:    &uid,
		Name:      req.Name,
		Type:      req.Type,
		URL:       req.URL,
		Behavior:  req.Behavior,
		Format:    format,
		Interval:  interval,
		IsPreset:  false,
		PresetTag: "",
	}
	if err := repository.DB.Create(rp).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "创建失败")
		return
	}
	OK(c, rp)
}

// GetRuleProvider 获取规则集详情
func GetRuleProvider(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var rp model.RuleProvider
	if err := repository.DB.Where("(user_id = ? OR is_preset = ?) AND id = ?", userID, true, id).First(&rp).Error; err != nil {
		Fail(c, http.StatusNotFound, "规则集不存在或无权限")
		return
	}
	OK(c, rp)
}

// UpdateRuleProvider 更新自定义规则集（内置预设不可修改）
func UpdateRuleProvider(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var rp model.RuleProvider
	if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&rp).Error; err != nil {
		Fail(c, http.StatusNotFound, "规则集不存在或无权限")
		return
	}
	if rp.IsPreset {
		Fail(c, http.StatusForbidden, "内置预设不可修改")
		return
	}

	var req ruleProviderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}
	if err := validateRuleProviderRequest(&req); err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	interval := req.Interval
	if interval <= 0 {
		interval = 86400
	}
	format := req.Format
	if format == "" {
		format = "yaml"
	}

	rp.Name = req.Name
	rp.Type = req.Type
	rp.URL = req.URL
	rp.Behavior = req.Behavior
	rp.Format = format
	rp.Interval = interval

	if err := repository.DB.Save(&rp).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "更新失败")
		return
	}
	OK(c, rp)
}

// DeleteRuleProvider 删除自定义规则集（内置预设不可删除）
func DeleteRuleProvider(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var rp model.RuleProvider
	if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&rp).Error; err != nil {
		Fail(c, http.StatusNotFound, "规则集不存在或无权限")
		return
	}
	if rp.IsPreset {
		Fail(c, http.StatusForbidden, "内置预设不可删除")
		return
	}

	if err := repository.DB.Delete(&rp).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "删除失败")
		return
	}
	OKMsg(c, "删除成功", nil)
}

func validateRuleProviderRequest(req *ruleProviderRequest) error {
	req.Type = strings.TrimSpace(req.Type)
	switch req.Type {
	case "http", "file":
	default:
		return fmt.Errorf("type 无效，可选: http | file")
	}
	req.Behavior = strings.TrimSpace(req.Behavior)
	switch req.Behavior {
	case "domain", "ipcidr", "classical":
	default:
		return fmt.Errorf("behavior 无效，可选: domain | ipcidr | classical")
	}
	if req.Type == "http" && strings.TrimSpace(req.URL) == "" {
		return fmt.Errorf("http 类型必须提供 url")
	}
	return nil
}
