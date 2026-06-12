package handler

import (
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strconv"
	"strings"

	"clash-config-store/internal/middleware"
	"clash-config-store/internal/model"
	"clash-config-store/internal/repository"
	"clash-config-store/internal/util"

	"github.com/gin-gonic/gin"
)

// UnifiedRuleSet 统一返回的规则集结构
type UnifiedRuleSet struct {
	ID         uint   `json:"id"`
	Name       string `json:"name"`
	SourceType string `json:"source_type"` // "external" 或 "hosted"
	Behavior   string `json:"behavior"`
	Format     string `json:"format"`
	// external 字段
	URL       string `json:"url,omitempty"`
	Interval  int    `json:"interval,omitempty"`
	IsPreset  bool   `json:"is_preset,omitempty"`
	PresetTag string `json:"preset_tag,omitempty"`
	// hosted 字段
	Content   string `json:"content,omitempty"` // 仅详情时返回
	Token     string `json:"token,omitempty"`
	HrsURL    string `json:"hrs_url,omitempty"` // 托管公开 URL
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

const timeLayout = "2006-01-02T15:04:05Z07:00"

// ListRuleSets GET /api/rule-sets?source_type=external|hosted
// 返回用户的全部规则集（外部 + 托管，不含系统预设 external 规则集）
func ListRuleSets(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	sourceType := c.Query("source_type")

	var result []UnifiedRuleSet

	if sourceType == "" || sourceType == "external" {
		var rps []model.RuleProvider
		query := repository.DB.Where("user_id = ?", userID)
		if err := query.Find(&rps).Error; err != nil {
			Fail(c, http.StatusInternalServerError, "查询失败")
			return
		}
		for _, rp := range rps {
			result = append(result, UnifiedRuleSet{
				ID:         rp.ID,
				Name:       rp.Name,
				SourceType: "external",
				Behavior:   rp.Behavior,
				Format:     rp.Format,
				URL:        rp.URL,
				Interval:   rp.Interval,
				IsPreset:   rp.IsPreset,
				PresetTag:  rp.PresetTag,
				CreatedAt:  rp.CreatedAt.Format(timeLayout),
				UpdatedAt:  rp.UpdatedAt.Format(timeLayout),
			})
		}
	}

	if sourceType == "" || sourceType == "hosted" {
		var hrss []model.HostedRuleSet
		if err := repository.DB.Where("user_id = ?", userID).Find(&hrss).Error; err != nil {
			Fail(c, http.StatusInternalServerError, "查询失败")
			return
		}
		for _, hrs := range hrss {
			result = append(result, UnifiedRuleSet{
				ID:         hrs.ID,
				Name:       hrs.Name,
				SourceType: "hosted",
				Behavior:   hrs.Behavior,
				Format:     hrs.Format,
				Token:      hrs.Token,
				HrsURL:     util.RuleSetPublicURL(hrs.Token, hrs.Name),
				CreatedAt:  hrs.CreatedAt.Format(timeLayout),
				UpdatedAt:  hrs.UpdatedAt.Format(timeLayout),
			})
		}
	}

	if result == nil {
		result = []UnifiedRuleSet{}
	}
	OK(c, result)
}

type ruleSetRequest struct {
	SourceType string `json:"source_type" binding:"required"` // "external" | "hosted"
	Name       string `json:"name" binding:"required"`
	Behavior   string `json:"behavior"`
	Format     string `json:"format"`
	// external 专有
	URL      string `json:"url"`
	Interval int    `json:"interval"`
	// hosted 专有
	Content string `json:"content"`
}

// CreateRuleSet 创建规则集（根据 source_type 决定操作哪张表）
func CreateRuleSet(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var req ruleSetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}

	switch req.SourceType {
	case "external":
		if err := validateRuleProviderRequest(&ruleProviderRequest{
			Name:     req.Name,
			Type:     "http",
			URL:      req.URL,
			Behavior: req.Behavior,
			Format:   req.Format,
			Interval: req.Interval,
		}); err != nil {
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
			UserID:   &uid,
			Name:     req.Name,
			Type:     "http",
			URL:      req.URL,
			Behavior: defaultBehavior(req.Behavior),
			Format:   format,
			Interval: interval,
			IsPreset: false,
		}
		if err := repository.DB.Create(rp).Error; err != nil {
			Fail(c, http.StatusInternalServerError, "创建失败")
			return
		}
		OK(c, UnifiedRuleSet{
			ID:         rp.ID,
			Name:       rp.Name,
			SourceType: "external",
			Behavior:   rp.Behavior,
			Format:     rp.Format,
			URL:        rp.URL,
			Interval:   rp.Interval,
			CreatedAt:  rp.CreatedAt.Format(timeLayout),
			UpdatedAt:  rp.UpdatedAt.Format(timeLayout),
		})

	case "hosted":
		hreq := hostedRuleSetRequest{
			Name:     req.Name,
			Behavior: req.Behavior,
			Format:   req.Format,
			Content:  req.Content,
		}
		if err := validateHostedRuleSetRequest(userID, 0, &hreq); err != nil {
			Fail(c, http.StatusBadRequest, err.Error())
			return
		}
		token, err := util.GenerateSubscriptionToken()
		if err != nil {
			Fail(c, http.StatusInternalServerError, "生成 token 失败")
			return
		}
		item := buildHostedRuleSetModel(userID, token, hreq)
		if err := repository.DB.Create(item).Error; err != nil {
			Fail(c, http.StatusInternalServerError, "创建失败")
			return
		}
		item.URL = hostedRuleSetURL(item)
		OK(c, UnifiedRuleSet{
			ID:         item.ID,
			Name:       item.Name,
			SourceType: "hosted",
			Behavior:   item.Behavior,
			Format:     item.Format,
			Token:      item.Token,
			HrsURL:     item.URL,
			CreatedAt:  item.CreatedAt.Format(timeLayout),
			UpdatedAt:  item.UpdatedAt.Format(timeLayout),
		})

	default:
		Fail(c, http.StatusBadRequest, "source_type 无效，可选: external | hosted")
	}
}

// UpdateRuleSet 更新规则集
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
		if err := validateRuleProviderRequest(&ruleProviderRequest{
			Name:     req.Name,
			Type:     "http",
			URL:      req.URL,
			Behavior: req.Behavior,
			Format:   req.Format,
			Interval: req.Interval,
		}); err != nil {
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
		rp.URL = req.URL
		rp.Behavior = defaultBehavior(req.Behavior)
		rp.Format = format
		rp.Interval = interval
		if err := repository.DB.Save(&rp).Error; err != nil {
			Fail(c, http.StatusInternalServerError, "更新失败")
			return
		}
		OK(c, UnifiedRuleSet{
			ID:         rp.ID,
			Name:       rp.Name,
			SourceType: "external",
			Behavior:   rp.Behavior,
			Format:     rp.Format,
			URL:        rp.URL,
			Interval:   rp.Interval,
			CreatedAt:  rp.CreatedAt.Format(timeLayout),
			UpdatedAt:  rp.UpdatedAt.Format(timeLayout),
		})

	case "hosted":
		var item model.HostedRuleSet
		if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&item).Error; err != nil {
			Fail(c, http.StatusNotFound, "规则集不存在或无权限")
			return
		}
		hreq := hostedRuleSetRequest{
			Name:     req.Name,
			Behavior: req.Behavior,
			Format:   req.Format,
			Content:  req.Content,
		}
		if err := validateHostedRuleSetRequest(userID, item.ID, &hreq); err != nil {
			Fail(c, http.StatusBadRequest, err.Error())
			return
		}
		sum := sha256.Sum256([]byte(req.Content))
		item.Name = strings.TrimSpace(req.Name)
		item.Behavior = defaultBehavior(req.Behavior)
		item.Format = defaultFormat(req.Format)
		item.Content = req.Content
		item.ContentSHA256 = hex.EncodeToString(sum[:])
		if err := repository.DB.Save(&item).Error; err != nil {
			Fail(c, http.StatusInternalServerError, "更新失败")
			return
		}
		item.URL = hostedRuleSetURL(&item)
		OK(c, UnifiedRuleSet{
			ID:         item.ID,
			Name:       item.Name,
			SourceType: "hosted",
			Behavior:   item.Behavior,
			Format:     item.Format,
			Token:      item.Token,
			HrsURL:     item.URL,
			CreatedAt:  item.CreatedAt.Format(timeLayout),
			UpdatedAt:  item.UpdatedAt.Format(timeLayout),
		})

	default:
		Fail(c, http.StatusBadRequest, "source_type 无效，可选: external | hosted")
	}
}

// DeleteRuleSet 删除规则集
func DeleteRuleSet(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	sourceType := c.Query("source_type")
	if sourceType == "" {
		// 尝试从请求体读取
		var body struct {
			SourceType string `json:"source_type"`
		}
		_ = c.ShouldBindJSON(&body)
		sourceType = body.SourceType
	}

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
		var item model.HostedRuleSet
		if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&item).Error; err != nil {
			Fail(c, http.StatusNotFound, "规则集不存在或无权限")
			return
		}
		if err := repository.DB.Delete(&item).Error; err != nil {
			Fail(c, http.StatusInternalServerError, "删除失败")
			return
		}
		OKMsg(c, "删除成功", nil)

	default:
		Fail(c, http.StatusBadRequest, "source_type 参数必须为 external 或 hosted")
	}
}
