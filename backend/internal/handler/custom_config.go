package handler

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"clash-config-store/internal/middleware"
	"clash-config-store/internal/model"
	"clash-config-store/internal/repository"
	"clash-config-store/internal/util"

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

// customConfigRequest 创建/更新自定义配置的请求体
type customConfigRequest struct {
	Name            string                   `json:"name" binding:"required"`
	Proxies         []map[string]interface{} `json:"proxies"`
	ProxyGroups     []map[string]interface{} `json:"proxy_groups"`
	Rules           []string                 `json:"rules"`
	RuleProviderIDs []uint                   `json:"rule_provider_ids"`
}

// CreateCustomConfig 创建自定义配置
func CreateCustomConfig(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var req customConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}

	if err := validateCustomConfigRequest(&req); err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	cfg := &model.CustomConfig{
		UserID:          userID,
		Name:            req.Name,
		Proxies:         nullSliceMaps(req.Proxies),
		ProxyGroups:     nullSliceMaps(req.ProxyGroups),
		Rules:           nullSliceStrings(req.Rules),
		RuleProviderIDs: nullSliceUints(req.RuleProviderIDs),
	}

	if err := repository.DB.Create(cfg).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "创建失败")
		return
	}
	OK(c, cfg)
}

// GetCustomConfig 获取自定义配置详情
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

// UpdateCustomConfig 更新自定义配置
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

	if err := validateCustomConfigRequest(&req); err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	cfg.Name = req.Name
	cfg.Proxies = nullSliceMaps(req.Proxies)
	cfg.ProxyGroups = nullSliceMaps(req.ProxyGroups)
	cfg.Rules = nullSliceStrings(req.Rules)
	cfg.RuleProviderIDs = nullSliceUints(req.RuleProviderIDs)

	if err := repository.DB.Save(&cfg).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "更新失败")
		return
	}
	OK(c, cfg)
}

// DeleteCustomConfig 删除自定义配置
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

// PreviewCustomConfig 生成当前配置的 YAML 预览（不依赖订阅，仅用于编辑器实时预览）
func PreviewCustomConfig(c *gin.Context) {
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

	// 加载关联规则集
	var ruleProviderInputs []util.RuleProviderInput
	if len(cfg.RuleProviderIDs) > 0 {
		var rps []model.RuleProvider
		repository.DB.Where("id IN ?", cfg.RuleProviderIDs).Find(&rps)
		for _, rp := range rps {
			ruleProviderInputs = append(ruleProviderInputs, util.RuleProviderInput{
				Name:     rp.Name,
				Type:     rp.Type,
				URL:      rp.URL,
				Behavior: rp.Behavior,
				Format:   rp.Format,
				Interval: rp.Interval,
			})
		}
	}

	// preview 没有真实订阅源数据，use: 展开留空（生成订阅时才会注入）
	yamlBytes, err := util.BuildMihomoConfig(
		"",
		nil,
		cfg.Proxies,
		cfg.ProxyGroups,
		cfg.Rules,
		"append",
		ruleProviderInputs,
		nil,
	)
	if err != nil {
		Fail(c, http.StatusInternalServerError, "YAML 生成失败: "+err.Error())
		return
	}

	c.Data(http.StatusOK, "text/plain; charset=utf-8", yamlBytes)
}

// validateCustomConfigRequest 校验自定义配置请求
func validateCustomConfigRequest(req *customConfigRequest) error {
	for i, p := range req.Proxies {
		name, _ := p["name"].(string)
		if strings.TrimSpace(name) == "" {
			return fmt.Errorf("proxies[%d] 缺少非空 name", i)
		}
		typ, _ := p["type"].(string)
		if strings.TrimSpace(typ) == "" {
			return fmt.Errorf("proxies[%d] 缺少非空 type", i)
		}
	}
	for i, g := range req.ProxyGroups {
		name, _ := g["name"].(string)
		if strings.TrimSpace(name) == "" {
			return fmt.Errorf("proxy_groups[%d] 缺少非空 name", i)
		}
		typ, _ := g["type"].(string)
		if strings.TrimSpace(typ) == "" {
			return fmt.Errorf("proxy_groups[%d] 缺少非空 type", i)
		}
	}
	for i, rule := range req.Rules {
		if err := util.ValidateMihomoRuleLine(rule); err != nil {
			return fmt.Errorf("rules[%d]: %w", i, err)
		}
	}
	return nil
}

// nullSliceMaps 将 nil 切片统一为空切片，避免 JSON 输出 null
func nullSliceMaps(s []map[string]interface{}) []map[string]interface{} {
	if s == nil {
		return []map[string]interface{}{}
	}
	return s
}

func nullSliceStrings(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

func nullSliceUints(s []uint) []uint {
	if s == nil {
		return []uint{}
	}
	return s
}
