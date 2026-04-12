package service

import (
	"encoding/json"
	"fmt"
	"net"
	"strings"
	"time"

	"clash-config-store/internal/model"
	"clash-config-store/internal/repository"
	"clash-config-store/internal/util"
)

// GenerateYAML 根据订阅 token 和客户端 IP 生成完整的 mihomo YAML 配置
// 返回 (yamlBytes, subscriptionID, allowed, denyReason, error)
func GenerateYAML(token string, clientIP string) ([]byte, uint, bool, string, error) {
	var sub model.Subscription
	if err := repository.DB.
		Preload("CustomConfig").
		Preload("ConfigTemplate").
		Where("token = ?", token).
		First(&sub).Error; err != nil {
		return nil, 0, false, "", fmt.Errorf("订阅不存在")
	}

	if sub.TokenExpiredAt != nil && time.Now().After(*sub.TokenExpiredAt) {
		return nil, sub.ID, false, "token 已过期", nil
	}

	var restrictions []model.AccessRestriction
	repository.DB.Where("subscription_id = ?", sub.ID).Find(&restrictions)

	allowed, denyReason := checkAccess(clientIP, restrictions)
	if !allowed {
		return nil, sub.ID, false, denyReason, nil
	}

	// 解析启用的 Provider IDs
	var providerIDs []uint
	if sub.EnabledProviderIDs != "" {
		_ = json.Unmarshal([]byte(sub.EnabledProviderIDs), &providerIDs)
	}

	var providers []model.Provider
	if len(providerIDs) > 0 {
		repository.DB.Where("id IN ?", providerIDs).Find(&providers)
	}

	// 收集 provider 代理节点，同时记录每个 provider 的节点名列表（供 use: 展开）
	providerProxies := make([]interface{}, 0)
	providerNodeNames := make(map[string][]string) // providerName -> []nodeName（含前缀）
	for _, p := range providers {
		if IsCacheStale(&p) {
			AsyncRefresh(p.ID)
		}
		proxies, err := util.ParseProxiesFromContent(p.CacheContent)
		if err != nil || proxies == nil {
			continue
		}
		if sub.ProxyPrefixEnabled {
			proxies = util.PrefixProxies(proxies, p.Name)
		}
		providerProxies = append(providerProxies, proxies...)

		// 提取本 provider 所有节点名，供 proxy-group use: 展开
		names := make([]string, 0, len(proxies))
		for _, px := range proxies {
			if pm, ok := px.(map[string]interface{}); ok {
				if name, ok := pm["name"].(string); ok && name != "" {
					names = append(names, name)
				}
			}
		}
		providerNodeNames[p.Name] = names
	}

	// 读取 CustomConfig 结构化数据
	var customProxies []map[string]interface{}
	var customGroups []map[string]interface{}
	var customRules []string
	var ruleProviderInputs []util.RuleProviderInput

	if sub.CustomConfig != nil {
		customProxies = sub.CustomConfig.Proxies
		customGroups = sub.CustomConfig.ProxyGroups
		customRules = sub.CustomConfig.Rules

		// 加载关联的规则集
		if len(sub.CustomConfig.RuleProviderIDs) > 0 {
			var rps []model.RuleProvider
			// 含系统预设（is_preset、user_id 可为 NULL），按 id 加载即可
			repository.DB.Where("id IN ?", sub.CustomConfig.RuleProviderIDs).Find(&rps)
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
	}

	// 读取 ConfigTemplate 内容
	var configTemplateContent string
	if sub.ConfigTemplate != nil {
		configTemplateContent = sub.ConfigTemplate.Content
	}

	yamlBytes, err := util.BuildMihomoConfig(
		configTemplateContent,
		providerProxies,
		customProxies,
		customGroups,
		customRules,
		string(sub.RuleInsertMode),
		ruleProviderInputs,
		providerNodeNames,
	)
	if err != nil {
		return nil, sub.ID, true, "", fmt.Errorf("构建配置失败: %w", err)
	}

	return yamlBytes, sub.ID, true, "", nil
}

// checkAccess 根据访问限制规则判断客户端 IP 是否允许访问
func checkAccess(clientIP string, restrictions []model.AccessRestriction) (bool, string) {
	if len(restrictions) == 0 {
		return true, ""
	}

	var allowRules []model.AccessRestriction
	var denyRules []model.AccessRestriction
	for _, r := range restrictions {
		if r.Mode == model.RestrictionAllow {
			allowRules = append(allowRules, r)
		} else {
			denyRules = append(denyRules, r)
		}
	}

	var geoInfo *util.GeoInfo
	for _, r := range restrictions {
		if r.Type == model.RestrictionTypeCountry {
			geoInfo = util.LookupIP(clientIP)
			break
		}
	}

	matchRule := func(r model.AccessRestriction) bool {
		switch r.Type {
		case model.RestrictionTypeIP:
			return clientIP == r.Value
		case model.RestrictionTypeCIDR:
			_, cidr, err := net.ParseCIDR(r.Value)
			if err != nil {
				return false
			}
			ip := net.ParseIP(clientIP)
			return ip != nil && cidr.Contains(ip)
		case model.RestrictionTypeCountry:
			if geoInfo == nil {
				return false
			}
			return strings.EqualFold(geoInfo.CountryCode, r.Value)
		}
		return false
	}

	for _, r := range denyRules {
		if matchRule(r) {
			return false, fmt.Sprintf("IP 已被拒绝访问 (%s: %s)", r.Type, r.Value)
		}
	}

	if len(allowRules) > 0 {
		for _, r := range allowRules {
			if matchRule(r) {
				return true, ""
			}
		}
		return false, "IP 不在允许访问列表中"
	}

	return true, ""
}
