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
	// 查询订阅，同时预加载 CustomConfig
	var sub model.Subscription
	if err := repository.DB.Preload("CustomConfig").Where("token = ?", token).First(&sub).Error; err != nil {
		return nil, 0, false, "", fmt.Errorf("订阅不存在")
	}

	// 检查 token 是否已过期
	if sub.TokenExpiredAt != nil && time.Now().After(*sub.TokenExpiredAt) {
		return nil, sub.ID, false, "token 已过期", nil
	}

	// 查询访问限制规则
	var restrictions []model.AccessRestriction
	repository.DB.Where("subscription_id = ?", sub.ID).Find(&restrictions)

	// 检查访问权限
	allowed, denyReason := checkAccess(clientIP, restrictions)
	if !allowed {
		return nil, sub.ID, false, denyReason, nil
	}

	// 解析启用的 Provider IDs（JSON []uint）
	var providerIDs []uint
	if sub.EnabledProviderIDs != "" {
		_ = json.Unmarshal([]byte(sub.EnabledProviderIDs), &providerIDs)
	}

	// 批量查询 Provider
	var providers []model.Provider
	if len(providerIDs) > 0 {
		repository.DB.Where("id IN ?", providerIDs).Find(&providers)
	}

	// 收集所有代理节点
	allProxies := make([]interface{}, 0)
	for _, p := range providers {
		// 缓存过期时触发后台异步刷新（不阻塞当前请求）
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

		allProxies = append(allProxies, proxies...)
	}

	// 追加 CustomConfig 中的自定义 proxies
	var customRules []string
	var proxyGroupsYAML string
	if sub.CustomConfig != nil {
		customProxies, err := util.ParseYAMLList(sub.CustomConfig.Proxies)
		if err == nil && customProxies != nil {
			allProxies = append(allProxies, customProxies...)
		}
		proxyGroupsYAML = sub.CustomConfig.ProxyGroups
		customRules = util.ParseRulesList(sub.CustomConfig.Rules)
	}

	// 构建完整 mihomo 配置
	yamlBytes, err := util.BuildMihomoConfig(
		sub.BaseConfig,
		allProxies,
		proxyGroupsYAML,
		customRules,
		string(sub.RuleInsertMode),
	)
	if err != nil {
		return nil, sub.ID, true, "", fmt.Errorf("构建配置失败: %w", err)
	}

	return yamlBytes, sub.ID, true, "", nil
}

// checkAccess 根据访问限制规则判断客户端 IP 是否允许访问
// - 无任何规则：直接允许
// - 仅有 allow 规则：白名单模式，命中才放行
// - 仅有 deny 规则：黑名单模式，命中则拒绝
// - 混合规则：先检查 deny，再检查 allow
func checkAccess(clientIP string, restrictions []model.AccessRestriction) (bool, string) {
	if len(restrictions) == 0 {
		return true, ""
	}

	// 分组整理规则
	var allowRules []model.AccessRestriction
	var denyRules []model.AccessRestriction
	for _, r := range restrictions {
		if r.Mode == model.RestrictionAllow {
			allowRules = append(allowRules, r)
		} else {
			denyRules = append(denyRules, r)
		}
	}

	// 按需查询地理信息（避免不必要的查询）
	var geoInfo *util.GeoInfo
	for _, r := range restrictions {
		if r.Type == model.RestrictionTypeCountry || r.Type == model.RestrictionTypeCity {
			geoInfo = util.LookupIP(clientIP)
			break
		}
	}

	// matchRule 判断单条规则是否命中
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
		case model.RestrictionTypeCity:
			if geoInfo == nil {
				return false
			}
			return strings.EqualFold(geoInfo.City, r.Value)
		}
		return false
	}

	// 先检查黑名单
	for _, r := range denyRules {
		if matchRule(r) {
			return false, fmt.Sprintf("IP 已被拒绝访问 (%s: %s)", r.Type, r.Value)
		}
	}

	// 再检查白名单（有 allow 规则时必须命中其中一条）
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
