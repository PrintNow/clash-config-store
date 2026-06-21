package handler

import (
	"encoding/json"
	"fmt"
	"log/slog"
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
	for i := range configs {
		normalizeCustomConfig(&configs[i])
	}
	OK(c, configs)
}

// customConfigRequest 创建/更新自定义配置的请求体
type customConfigRequest struct {
	Name             string                   `json:"name" binding:"required"`
	ProxyGroups      []map[string]interface{} `json:"proxy_groups"`
	Rules            []string                 `json:"rules"`
	RuleProviderIDs  []uint                   `json:"rule_provider_ids"`
	HostedRuleSetIDs []uint                   `json:"hosted_rule_set_ids"`
}

type customConfigTransferPayload struct {
	Name             string                   `json:"name"`
	ProxyGroups      []map[string]interface{} `json:"proxy_groups"`
	Rules            []string                 `json:"rules"`
	RuleProviderIDs  []uint                   `json:"rule_provider_ids"`
	HostedRuleSetIDs []uint                   `json:"hosted_rule_set_ids"`
}

// CreateCustomConfig 创建自定义配置
func CreateCustomConfig(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var req customConfigRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}

	if err := validateCustomConfigRequest(userID, &req); err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	req.RuleProviderIDs, req.HostedRuleSetIDs, _ = normalizeCustomConfigRuleSetRefs(userID, req.RuleProviderIDs, req.HostedRuleSetIDs)

	cfg := &model.CustomConfig{
		UserID:           userID,
		Name:             req.Name,
		ProxyGroups:      nullSliceMaps(req.ProxyGroups),
		Rules:            nullSliceStrings(req.Rules),
		RuleProviderIDs:  nullSliceUints(req.RuleProviderIDs),
		HostedRuleSetIDs: nullSliceUints(req.HostedRuleSetIDs),
	}

	if err := repository.DB.Create(cfg).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "创建失败")
		return
	}
	OK(c, cfg)
}

// CloneCustomConfig 克隆现有自定义配置
func CloneCustomConfig(c *gin.Context) {
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

	clone := &model.CustomConfig{
		UserID:           userID,
		Name:             uniqueCustomConfigName(userID, cfg.Name+" - 副本"),
		ProxyGroups:      cloneSliceMaps(cfg.ProxyGroups),
		Rules:            cloneSliceStrings(cfg.Rules),
		RuleProviderIDs:  cloneSliceUints(cfg.RuleProviderIDs),
		HostedRuleSetIDs: cloneSliceUints(cfg.HostedRuleSetIDs),
	}

	if err := repository.DB.Create(clone).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "克隆失败")
		return
	}
	normalizeCustomConfig(clone)
	OK(c, clone)
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
	normalizeCustomConfig(&cfg)
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

	if err := validateCustomConfigRequest(userID, &req); err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	req.RuleProviderIDs, req.HostedRuleSetIDs, _ = normalizeCustomConfigRuleSetRefs(userID, req.RuleProviderIDs, req.HostedRuleSetIDs)

	cfg.Name = req.Name
	cfg.ProxyGroups = nullSliceMaps(req.ProxyGroups)
	cfg.Rules = nullSliceStrings(req.Rules)
	cfg.RuleProviderIDs = nullSliceUints(req.RuleProviderIDs)
	cfg.HostedRuleSetIDs = nullSliceUints(req.HostedRuleSetIDs)

	if err := repository.DB.Save(&cfg).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "更新失败")
		return
	}

	// 保存变更历史（异步，不影响响应）
	go func(saved model.CustomConfig) {
		history := model.ConfigHistory{
			CustomConfigID:   saved.ID,
			UserID:           saved.UserID,
			Name:             saved.Name,
			ProxyGroups:      saved.ProxyGroups,
			Rules:            saved.Rules,
			RuleProviderIDs:  saved.RuleProviderIDs,
			HostedRuleSetIDs: saved.HostedRuleSetIDs,
		}
		if err := repository.DB.Create(&history).Error; err != nil {
			slog.Error("保存配置变更历史失败", slog.String("component", "config_history"), slog.Uint64("config_id", uint64(saved.ID)), slog.Any("err", err))
		}
		pruneConfigHistory(saved.ID)
	}(cfg)

	normalizeCustomConfig(&cfg)
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

// ExportCustomConfig 导出可回灌的 JSON 快照
func ExportCustomConfig(c *gin.Context) {
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

	payload := customConfigTransferPayload{
		Name:             cfg.Name,
		ProxyGroups:      nullSliceMaps(cfg.ProxyGroups),
		Rules:            nullSliceStrings(cfg.Rules),
		RuleProviderIDs:  nullSliceUints(cfg.RuleProviderIDs),
		HostedRuleSetIDs: nullSliceUints(cfg.HostedRuleSetIDs),
	}

	data, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		Fail(c, http.StatusInternalServerError, "导出失败")
		return
	}

	filename := sanitizeExportFilename(cfg.Name, uint(id))
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	c.Data(http.StatusOK, "application/json; charset=utf-8", data)
}

// ImportCustomConfig 导入自定义配置 JSON 快照
func ImportCustomConfig(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var req customConfigTransferPayload
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		req.Name = "导入配置"
	}

	createReq := customConfigRequest{
		Name:             uniqueCustomConfigName(userID, req.Name),
		ProxyGroups:      nullSliceMaps(req.ProxyGroups),
		Rules:            nullSliceStrings(req.Rules),
		RuleProviderIDs:  nullSliceUints(req.RuleProviderIDs),
		HostedRuleSetIDs: nullSliceUints(req.HostedRuleSetIDs),
	}
	if err := validateCustomConfigRequest(userID, &createReq); err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	createReq.RuleProviderIDs, createReq.HostedRuleSetIDs, _ = normalizeCustomConfigRuleSetRefs(userID, createReq.RuleProviderIDs, createReq.HostedRuleSetIDs)

	cfg := &model.CustomConfig{
		UserID:           userID,
		Name:             createReq.Name,
		ProxyGroups:      createReq.ProxyGroups,
		Rules:            createReq.Rules,
		RuleProviderIDs:  createReq.RuleProviderIDs,
		HostedRuleSetIDs: createReq.HostedRuleSetIDs,
	}

	if err := repository.DB.Create(cfg).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "导入失败")
		return
	}
	OK(c, cfg)
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
	ruleProviderInputs, err := loadCustomConfigRuleProviderInputs(userID, cfg.RuleProviderIDs, cfg.HostedRuleSetIDs)
	if err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	// preview 没有真实订阅源数据，use: 展开留空（生成订阅时才会注入）
	yamlBytes, err := util.BuildMihomoConfig(
		"",
		nil,
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
func validateCustomConfigRequest(userID uint, req *customConfigRequest) error {
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
	if _, _, err := normalizeCustomConfigRuleSetRefs(userID, req.RuleProviderIDs, req.HostedRuleSetIDs); err != nil {
		return err
	}
	return nil
}

// normalizeCustomConfig 将所有 nil 切片字段替换为空切片，避免 JSON 输出 null
func normalizeCustomConfig(cfg *model.CustomConfig) {
	cfg.ProxyGroups = nullSliceMaps(cfg.ProxyGroups)
	cfg.Rules = nullSliceStrings(cfg.Rules)
	cfg.RuleProviderIDs = nullSliceUints(cfg.RuleProviderIDs)
	cfg.HostedRuleSetIDs = nullSliceUints(cfg.HostedRuleSetIDs)
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

func cloneSliceMaps(s []map[string]interface{}) []map[string]interface{} {
	if len(s) == 0 {
		return []map[string]interface{}{}
	}
	data, err := json.Marshal(s)
	if err != nil {
		return []map[string]interface{}{}
	}
	var out []map[string]interface{}
	if err := json.Unmarshal(data, &out); err != nil {
		return []map[string]interface{}{}
	}
	return out
}

func cloneSliceStrings(s []string) []string {
	if len(s) == 0 {
		return []string{}
	}
	return append([]string(nil), s...)
}

func cloneSliceUints(s []uint) []uint {
	if len(s) == 0 {
		return []uint{}
	}
	return append([]uint(nil), s...)
}

func loadCustomConfigRuleProviderInputs(userID uint, ruleProviderIDs []uint, hostedRuleSetIDs []uint) ([]util.RuleProviderInput, error) {
	ruleProviderIDs, hostedRuleSetIDs, err := normalizeCustomConfigRuleSetRefs(userID, ruleProviderIDs, hostedRuleSetIDs)
	if err != nil {
		return nil, err
	}

	inputs := make([]util.RuleProviderInput, 0, len(ruleProviderIDs)+len(hostedRuleSetIDs))

	if len(ruleProviderIDs) > 0 {
		var rps []model.RuleProvider
		if err := repository.DB.
			Where("id IN ?", ruleProviderIDs).
			Where("user_id = ? OR is_preset = ?", userID, true).
			Find(&rps).Error; err != nil {
			return nil, err
		}
		for _, rp := range rps {
			inputs = append(inputs, util.RuleProviderInput{
				Name:     rp.Name,
				Type:     rp.Type,
				URL:      rp.URL,
				Behavior: rp.Behavior,
				Format:   rp.Format,
				Interval: rp.Interval,
			})
		}
	}

	if len(hostedRuleSetIDs) > 0 {
		var hosted []model.HostedRuleSet
		if err := repository.DB.
			Where("id IN ? AND user_id = ?", hostedRuleSetIDs, userID).
			Find(&hosted).Error; err != nil {
			return nil, err
		}
		for _, hrs := range hosted {
			inputs = append(inputs, util.RuleProviderInput{
				Name:     hrs.Name,
				Type:     "http",
				URL:      util.RuleSetPublicURL(hrs.Token, hrs.Name),
				Behavior: hrs.Behavior,
				Format:   hrs.Format,
				Interval: 86400,
			})
		}
	}

	return inputs, nil
}

func normalizeCustomConfigRuleSetRefs(userID uint, ruleProviderIDs []uint, hostedRuleSetIDs []uint) ([]uint, []uint, error) {
	normalizedRuleProviderIDs := make([]uint, 0, len(ruleProviderIDs))
	normalizedHostedRuleSetIDs := append([]uint(nil), hostedRuleSetIDs...)
	hostedSeen := make(map[uint]struct{}, len(normalizedHostedRuleSetIDs))
	names := make(map[string]struct{})

	for _, id := range normalizedHostedRuleSetIDs {
		hostedSeen[id] = struct{}{}
	}

	if len(ruleProviderIDs) > 0 {
		var rps []model.RuleProvider
		if err := repository.DB.
			Where("id IN ?", ruleProviderIDs).
			Where("user_id = ? OR is_preset = ?", userID, true).
			Find(&rps).Error; err != nil {
			return nil, nil, err
		}

		for _, rp := range rps {
			if _, exists := names[rp.Name]; exists {
				return nil, nil, fmt.Errorf("规则集名称 %q 重复，请先调整名称", rp.Name)
			}
			names[rp.Name] = struct{}{}
			normalizedRuleProviderIDs = append(normalizedRuleProviderIDs, rp.ID)
		}
	}

	if len(normalizedHostedRuleSetIDs) > 0 {
		var hosted []model.HostedRuleSet
		if err := repository.DB.
			Where("id IN ? AND user_id = ?", normalizedHostedRuleSetIDs, userID).
			Find(&hosted).Error; err != nil {
			return nil, nil, err
		}

		validHostedIDs := make([]uint, 0, len(hosted))
		for _, hrs := range hosted {
			if _, exists := names[hrs.Name]; exists {
				return nil, nil, fmt.Errorf("规则集名称 %q 重复，请先调整名称", hrs.Name)
			}
			names[hrs.Name] = struct{}{}
			validHostedIDs = append(validHostedIDs, hrs.ID)
		}
		normalizedHostedRuleSetIDs = validHostedIDs
	}

	return normalizedRuleProviderIDs, normalizedHostedRuleSetIDs, nil
}

func uniqueCustomConfigName(userID uint, baseName string) string {
	baseName = strings.TrimSpace(baseName)
	if baseName == "" {
		baseName = "未命名配置"
	}

	name := baseName
	for i := 2; ; i++ {
		var count int64
		repository.DB.Model(&model.CustomConfig{}).
			Where("user_id = ? AND name = ?", userID, name).
			Count(&count)
		if count == 0 {
			return name
		}
		name = fmt.Sprintf("%s %d", baseName, i)
	}
}

func sanitizeExportFilename(name string, id uint) string {
	name = strings.TrimSpace(name)
	if name == "" {
		name = "config"
	}
	replacer := strings.NewReplacer("/", "-", "\\", "-", " ", "-", "\"", "", "'", "")
	return fmt.Sprintf("custom-config-%s-%d.json", replacer.Replace(name), id)
}
