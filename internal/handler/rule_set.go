package handler

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"clash-config-store/internal/middleware"
	"clash-config-store/internal/model"
	"clash-config-store/internal/repository"
	"clash-config-store/internal/service"
	"clash-config-store/internal/util"

	"github.com/gin-gonic/gin"
)

var hostedRuleSetNamePattern = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)

// UnifiedRuleSet 统一返回的规则集结构（外部引用 + 自托管）
type UnifiedRuleSet struct {
	ID         uint   `json:"id"`
	Name       string `json:"name"`
	SourceType string `json:"source_type"` // "external" | "hosted"
	Behavior   string `json:"behavior"`
	Format     string `json:"format"`
	RuleCount  int    `json:"rule_count"`
	// external 字段
	URL                string `json:"url,omitempty"`
	Interval           int    `json:"interval,omitempty"`
	IsPreset           bool   `json:"is_preset,omitempty"`
	PresetTag          string `json:"preset_tag,omitempty"`
	ServerCacheEnabled bool   `json:"server_cache_enabled,omitempty"`
	// hosted 字段
	Content string `json:"content,omitempty"`
	Token   string `json:"token,omitempty"`
	HrsURL  string `json:"hrs_url,omitempty"`
	// 公共时间字段
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

const timeLayout = "2006-01-02T15:04:05Z07:00"

// ListRuleSets GET /api/rule-sets?source_type=external|hosted
func ListRuleSets(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	sourceType := c.Query("source_type")

	var result []UnifiedRuleSet

	if sourceType == "" || sourceType == "external" {
		var rps []model.RuleProvider
		if err := repository.DB.
			Where("user_id = ? OR is_preset = ?", userID, true).
			Order("is_preset DESC, id ASC").
			Find(&rps).Error; err != nil {
			Fail(c, http.StatusInternalServerError, "查询失败")
			return
		}
		for _, rp := range rps {
			result = append(result, ruleProviderToUnified(&rp))
		}
	}

	if sourceType == "" || sourceType == "hosted" {
		var hrss []model.HostedRuleSet
		if err := repository.DB.Where("user_id = ?", userID).Order("id ASC").Find(&hrss).Error; err != nil {
			Fail(c, http.StatusInternalServerError, "查询失败")
			return
		}
		for _, hrs := range hrss {
			result = append(result, hostedRuleSetToUnified(&hrs))
		}
	}

	if result == nil {
		result = []UnifiedRuleSet{}
	}
	OK(c, result)
}

// GetRuleSet GET /api/rule-sets/:id?source_type=external|hosted
func GetRuleSet(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}
	sourceType := c.Query("source_type")

	switch sourceType {
	case "external":
		var rp model.RuleProvider
		if err := repository.DB.Where("(user_id = ? OR is_preset = ?) AND id = ?", userID, true, id).First(&rp).Error; err != nil {
			Fail(c, http.StatusNotFound, "规则集不存在或无权限")
			return
		}
		OK(c, ruleProviderToUnified(&rp))
	case "hosted":
		var hrs model.HostedRuleSet
		if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&hrs).Error; err != nil {
			Fail(c, http.StatusNotFound, "规则集不存在或无权限")
			return
		}
		unified := hostedRuleSetToUnified(&hrs)
		unified.Content = hrs.Content
		OK(c, unified)
	default:
		Fail(c, http.StatusBadRequest, "source_type 参数必须为 external 或 hosted")
	}
}

type ruleSetRequest struct {
	SourceType string `json:"source_type" binding:"required"`
	Name       string `json:"name" binding:"required"`
	Behavior   string `json:"behavior"`
	Format     string `json:"format"`
	// external 专有
	URL                string `json:"url"`
	Interval           int    `json:"interval"`
	ServerCacheEnabled bool   `json:"server_cache_enabled"`
	// hosted 专有
	Content string `json:"content"`
}

// CreateRuleSet POST /api/rule-sets
func CreateRuleSet(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var req ruleSetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}

	switch req.SourceType {
	case "external":
		if err := validateExternalRuleSet(req.Name, req.URL, req.Behavior, req.Format); err != nil {
			Fail(c, http.StatusBadRequest, err.Error())
			return
		}
		uid := userID
		rp := &model.RuleProvider{
			UserID:             &uid,
			Name:               req.Name,
			Type:               "http",
			URL:                req.URL,
			Behavior:           defaultBehavior(req.Behavior),
			Format:             defaultFormat(req.Format),
			Interval:           defaultInterval(req.Interval),
			IsPreset:           false,
			ServerCacheEnabled: req.ServerCacheEnabled,
		}
		if req.ServerCacheEnabled {
			cacheToken, err := util.GenerateSubscriptionToken()
			if err != nil {
				Fail(c, http.StatusInternalServerError, "生成 cache token 失败")
				return
			}
			rp.CacheToken = cacheToken
		}
		if err := repository.DB.Create(rp).Error; err != nil {
			Fail(c, http.StatusInternalServerError, "创建失败")
			return
		}
		if req.ServerCacheEnabled {
			service.AsyncFetchAndCacheRuleProvider(rp.ID)
		}
		OK(c, ruleProviderToUnified(rp))

	case "hosted":
		if err := validateHostedRuleSet(userID, 0, req.Name, req.Content, req.Behavior, req.Format); err != nil {
			Fail(c, http.StatusBadRequest, err.Error())
			return
		}
		token, err := util.GenerateSubscriptionToken()
		if err != nil {
			Fail(c, http.StatusInternalServerError, "生成 token 失败")
			return
		}
		hrs := buildHostedRuleSet(userID, token, req.Name, req.Content, req.Behavior, req.Format)
		if err := repository.DB.Create(hrs).Error; err != nil {
			Fail(c, http.StatusInternalServerError, "创建失败")
			return
		}
		OK(c, hostedRuleSetToUnified(hrs))

	default:
		Fail(c, http.StatusBadRequest, "source_type 无效，可选: external | hosted")
	}
}

// UpdateRuleSet PUT /api/rule-sets/:id
func UpdateRuleSet(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var req ruleSetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}

	switch req.SourceType {
	case "external":
		var rp model.RuleProvider
		if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&rp).Error; err != nil {
			Fail(c, http.StatusNotFound, "规则集不存在或无权限")
			return
		}
		if rp.IsPreset {
			Fail(c, http.StatusForbidden, "内置预设不可修改")
			return
		}
		if err := validateExternalRuleSet(req.Name, req.URL, req.Behavior, req.Format); err != nil {
			Fail(c, http.StatusBadRequest, err.Error())
			return
		}
		justEnabled := req.ServerCacheEnabled && !rp.ServerCacheEnabled
		rp.Name = req.Name
		rp.URL = req.URL
		rp.Behavior = defaultBehavior(req.Behavior)
		rp.Format = defaultFormat(req.Format)
		rp.Interval = defaultInterval(req.Interval)
		rp.ServerCacheEnabled = req.ServerCacheEnabled
		if req.ServerCacheEnabled && rp.CacheToken == "" {
			cacheToken, err := util.GenerateSubscriptionToken()
			if err != nil {
				Fail(c, http.StatusInternalServerError, "生成 cache token 失败")
				return
			}
			rp.CacheToken = cacheToken
		}
		if err := repository.DB.Save(&rp).Error; err != nil {
			Fail(c, http.StatusInternalServerError, "更新失败")
			return
		}
		if justEnabled {
			service.AsyncFetchAndCacheRuleProvider(rp.ID)
		}
		OK(c, ruleProviderToUnified(&rp))

	case "hosted":
		var hrs model.HostedRuleSet
		if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&hrs).Error; err != nil {
			Fail(c, http.StatusNotFound, "规则集不存在或无权限")
			return
		}
		if err := validateHostedRuleSet(userID, hrs.ID, req.Name, req.Content, req.Behavior, req.Format); err != nil {
			Fail(c, http.StatusBadRequest, err.Error())
			return
		}
		sum := sha256.Sum256([]byte(req.Content))
		hrs.Name = strings.TrimSpace(req.Name)
		hrs.Behavior = defaultBehavior(req.Behavior)
		hrs.Format = defaultFormat(req.Format)
		hrs.Content = req.Content
		hrs.ContentSHA256 = hex.EncodeToString(sum[:])
		hrs.RuleCount = util.CountRules(req.Content, defaultFormat(req.Format))
		if err := repository.DB.Save(&hrs).Error; err != nil {
			Fail(c, http.StatusInternalServerError, "更新失败")
			return
		}
		OK(c, hostedRuleSetToUnified(&hrs))

	default:
		Fail(c, http.StatusBadRequest, "source_type 无效，可选: external | hosted")
	}
}

// UpdateRuleSetCacheMode PATCH /api/rule-sets/:id/cache-mode
// 切换外部规则集（含内置预设）的拉取方式：服务器缓存 / 源站直接
func UpdateRuleSetCacheMode(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var req struct {
		ServerCacheEnabled bool `json:"server_cache_enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}

	var rp model.RuleProvider
	if err := repository.DB.Where("id = ? AND (user_id = ? OR is_preset = ?)", id, userID, true).First(&rp).Error; err != nil {
		Fail(c, http.StatusNotFound, "规则集不存在或无权限")
		return
	}

	// 预设规则集为全局共享资源，仅管理员可修改其缓存模式
	if rp.IsPreset {
		var currentUser model.User
		if err := repository.DB.First(&currentUser, userID).Error; err != nil {
			Fail(c, http.StatusInternalServerError, "获取用户信息失败")
			return
		}
		if !currentUser.IsAdmin {
			Fail(c, http.StatusForbidden, "无权限修改预设规则集缓存模式")
			return
		}
	}

	updates := map[string]interface{}{
		"server_cache_enabled": req.ServerCacheEnabled,
	}
	if req.ServerCacheEnabled && rp.CacheToken == "" {
		cacheToken, err := util.GenerateSubscriptionToken()
		if err != nil {
			Fail(c, http.StatusInternalServerError, "生成 cache token 失败")
			return
		}
		updates["cache_token"] = cacheToken
	}

	if err := repository.DB.Model(&rp).Updates(updates).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "更新失败")
		return
	}
	// 刷新结构体以反映 updates
	rp.ServerCacheEnabled = req.ServerCacheEnabled
	if t, ok := updates["cache_token"]; ok {
		rp.CacheToken = t.(string)
	}
	OK(c, ruleProviderToUnified(&rp))
}

// DeleteRuleSet DELETE /api/rule-sets/:id?source_type=external|hosted
func DeleteRuleSet(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}
	sourceType := c.Query("source_type")

	switch sourceType {
	case "external":
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

	case "hosted":
		var hrs model.HostedRuleSet
		if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&hrs).Error; err != nil {
			Fail(c, http.StatusNotFound, "规则集不存在或无权限")
			return
		}
		if err := repository.DB.Delete(&hrs).Error; err != nil {
			Fail(c, http.StatusInternalServerError, "删除失败")
			return
		}
		OKMsg(c, "删除成功", nil)

	default:
		Fail(c, http.StatusBadRequest, "source_type 参数必须为 external 或 hosted")
	}
}

// ResetHostedRuleSetTokens POST /api/rule-sets/reset-hosted-tokens
func ResetHostedRuleSetTokens(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var items []model.HostedRuleSet
	if err := repository.DB.Where("user_id = ?", userID).Find(&items).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "查询失败")
		return
	}
	for _, item := range items {
		token, err := util.GenerateSubscriptionToken()
		if err != nil {
			Fail(c, http.StatusInternalServerError, "生成 token 失败")
			return
		}
		if err := repository.DB.Model(&model.HostedRuleSet{}).
			Where("id = ? AND user_id = ?", item.ID, userID).
			Update("token", token).Error; err != nil {
			Fail(c, http.StatusInternalServerError, "更新失败")
			return
		}
	}
	OKMsg(c, "已重置全部托管规则集 token", nil)
}

// --- 内部辅助函数 ---

func ruleProviderToUnified(rp *model.RuleProvider) UnifiedRuleSet {
	return UnifiedRuleSet{
		ID:                 rp.ID,
		Name:               rp.Name,
		SourceType:         "external",
		Behavior:           rp.Behavior,
		Format:             rp.Format,
		RuleCount:          rp.RuleCount,
		URL:                rp.URL,
		Interval:           rp.Interval,
		IsPreset:           rp.IsPreset,
		PresetTag:          rp.PresetTag,
		ServerCacheEnabled: rp.ServerCacheEnabled,
		CreatedAt:          rp.CreatedAt.Format(timeLayout),
		UpdatedAt:          rp.UpdatedAt.Format(timeLayout),
	}
}

func hostedRuleSetToUnified(hrs *model.HostedRuleSet) UnifiedRuleSet {
	return UnifiedRuleSet{
		ID:         hrs.ID,
		Name:       hrs.Name,
		SourceType: "hosted",
		Behavior:   hrs.Behavior,
		Format:     hrs.Format,
		RuleCount:  hrs.RuleCount,
		Token:      hrs.Token,
		HrsURL:     util.RuleSetPublicURL(hrs.Token, hrs.Name),
		CreatedAt:  hrs.CreatedAt.Format(timeLayout),
		UpdatedAt:  hrs.UpdatedAt.Format(timeLayout),
	}
}

func buildHostedRuleSet(userID uint, token, name, content, behavior, format string) *model.HostedRuleSet {
	sum := sha256.Sum256([]byte(content))
	resolvedFormat := defaultFormat(format)
	return &model.HostedRuleSet{
		UserID:        userID,
		Name:          strings.TrimSpace(name),
		Behavior:      defaultBehavior(behavior),
		Format:        resolvedFormat,
		Content:       content,
		ContentSHA256: hex.EncodeToString(sum[:]),
		Token:         token,
		RuleCount:     util.CountRules(content, resolvedFormat),
	}
}

func validateExternalRuleSet(name, url, behavior, format string) error {
	if strings.TrimSpace(name) == "" {
		return fmt.Errorf("name 不能为空")
	}
	if strings.TrimSpace(url) == "" {
		return fmt.Errorf("url 不能为空")
	}
	if behavior != "" {
		switch behavior {
		case "domain", "ipcidr", "classical":
		default:
			return fmt.Errorf("behavior 无效，可选: domain | ipcidr | classical")
		}
	}
	if format != "" {
		switch format {
		case "yaml", "text", "mrs":
		default:
			return fmt.Errorf("format 无效，可选: yaml | text | mrs")
		}
	}
	return nil
}

func validateHostedRuleSet(userID uint, currentID uint, name, content, behavior, format string) error {
	name = strings.TrimSpace(name)
	if name == "" {
		return fmt.Errorf("name 不能为空")
	}
	if !hostedRuleSetNamePattern.MatchString(name) {
		return fmt.Errorf("name 仅允许字母、数字、下划线和短横线")
	}
	if strings.TrimSpace(content) == "" {
		return fmt.Errorf("content 不能为空")
	}
	if behavior != "" {
		switch behavior {
		case "domain", "ipcidr", "classical":
		default:
			return fmt.Errorf("behavior 无效，可选: domain | ipcidr | classical")
		}
	}
	if format != "" {
		switch format {
		case "yaml", "text":
		default:
			return fmt.Errorf("format 无效，可选: yaml | text")
		}
	}
	query := repository.DB.Model(&model.HostedRuleSet{}).Where("user_id = ? AND name = ?", userID, name)
	if currentID != 0 {
		query = query.Where("id <> ?", currentID)
	}
	var count int64
	if err := query.Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return fmt.Errorf("名称已存在")
	}
	return nil
}

func defaultFormat(v string) string {
	if strings.TrimSpace(v) == "" {
		return "yaml"
	}
	return strings.TrimSpace(v)
}

func defaultBehavior(v string) string {
	if strings.TrimSpace(v) == "" {
		return "domain"
	}
	return strings.TrimSpace(v)
}

func defaultInterval(v int) int {
	if v <= 0 {
		return 86400
	}
	return v
}
