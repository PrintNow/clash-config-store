package service

import (
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

	// 从 CustomConfig 的代理组 use: 字段推导所需 Provider，按名字查询
	var providers []model.Provider
	if sub.CustomConfig != nil {
		referencedNames := extractProviderNamesFromGroups(sub.CustomConfig.ProxyGroups)
		if len(referencedNames) > 0 {
			repository.DB.Where("name IN ? AND user_id = ?", referencedNames, sub.UserID).Find(&providers)
		}
	}

	// 收集 provider 代理节点，同时记录每个 provider 的节点名列表（供 use: 展开）
	providerProxies := make([]interface{}, 0)
	providerNodeNames := make(map[string][]string) // providerName -> []nodeName（含前缀）
	for _, p := range providers {
		var proxies []interface{}
		if p.Type == model.ProviderTypeInline {
			// inline provider 直接读 Payload
			for _, node := range p.Payload {
				proxies = append(proxies, node)
			}
		} else {
			// http provider 从缓存读取
			if IsCacheStale(&p) {
				AsyncRefresh(p.ID)
			}
			var err error
			proxies, err = util.ParseProxiesFromContent(p.CacheContent)
			if err != nil || proxies == nil {
				continue
			}
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
	var customGroups []map[string]interface{}
	var customRules []string
	var ruleProviderInputs []util.RuleProviderInput
	var err error

	if sub.CustomConfig != nil {
		customGroups = sub.CustomConfig.ProxyGroups
		customRules = sub.CustomConfig.Rules

		ruleProviderInputs, err = loadSubscriptionRuleProviderInputs(
			sub.UserID,
			sub.CustomConfig.RuleProviderIDs,
			sub.CustomConfig.HostedRuleSetIDs,
		)
		if err != nil {
			return nil, sub.ID, true, "", err
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

func loadSubscriptionRuleProviderInputs(userID uint, ruleProviderIDs []uint, hostedRuleSetIDs []uint) ([]util.RuleProviderInput, error) {
	inputs := make([]util.RuleProviderInput, 0, len(ruleProviderIDs)+len(hostedRuleSetIDs))
	names := make(map[string]struct{}, len(ruleProviderIDs)+len(hostedRuleSetIDs))
	hostedSeen := make(map[uint]struct{}, len(hostedRuleSetIDs))

	for _, id := range hostedRuleSetIDs {
		hostedSeen[id] = struct{}{}
	}

	if len(ruleProviderIDs) > 0 {
		var rps []model.RuleProvider
		if err := repository.DB.
			Where("id IN ?", ruleProviderIDs).
			Where("user_id = ? OR is_preset = ?", userID, true).
			Find(&rps).Error; err != nil {
			return nil, err
		}
		for _, rp := range rps {
			if _, exists := names[rp.Name]; exists {
				return nil, fmt.Errorf("规则集名称 %q 重复", rp.Name)
			}
			names[rp.Name] = struct{}{}
			rpURL := rp.URL
			if rp.ServerCacheEnabled && rp.CacheToken != "" {
				rpURL = util.RuleProviderCacheURL(rp.CacheToken)
				if IsRuleProviderCacheStale(&rp) {
					AsyncFetchAndCacheRuleProvider(rp.ID)
				}
			}
			inputs = append(inputs, util.RuleProviderInput{
				Name:     rp.Name,
				Type:     rp.Type,
				URL:      rpURL,
				Behavior: rp.Behavior,
				Format:   rp.Format,
				Interval: rp.Interval,
			})
		}
	}

	if len(hostedSeen) > 0 {
		ids := make([]uint, 0, len(hostedSeen))
		for id := range hostedSeen {
			ids = append(ids, id)
		}

		var hosted []model.HostedRuleSet
		if err := repository.DB.Where("id IN ? AND user_id = ?", ids, userID).Find(&hosted).Error; err != nil {
			return nil, err
		}
		for _, hrs := range hosted {
			if _, exists := names[hrs.Name]; exists {
				return nil, fmt.Errorf("规则集名称 %q 重复", hrs.Name)
			}
			names[hrs.Name] = struct{}{}
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

// extractProviderNamesFromGroups 从代理组的 use: 字段中提取被引用的 Provider 名（去重）
func extractProviderNamesFromGroups(groups []map[string]interface{}) []string {
	seen := make(map[string]struct{})
	names := make([]string, 0)
	for _, g := range groups {
		use, ok := g["use"]
		if !ok {
			continue
		}
		switch v := use.(type) {
		case []interface{}:
			for _, item := range v {
				if name, ok := item.(string); ok && name != "" {
					if _, exists := seen[name]; !exists {
						seen[name] = struct{}{}
						names = append(names, name)
					}
				}
			}
		case []string:
			for _, name := range v {
				if name != "" {
					if _, exists := seen[name]; !exists {
						seen[name] = struct{}{}
						names = append(names, name)
					}
				}
			}
		}
	}
	return names
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
