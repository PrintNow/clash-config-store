package util

import (
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

// MihomoConfig 表示完整的 mihomo 配置文件结构（使用 map 保持灵活性）
type MihomoConfig map[string]interface{}

// RuleProviderInput BuildMihomoConfig 接收的规则集描述（来自 model.RuleProvider）
type RuleProviderInput struct {
	Name     string // 在 rule-providers 中的键名，RULE-SET 规则引用此名
	Type     string // http | file
	URL      string
	Behavior string // domain | ipcidr | classical
	Format   string // yaml | text | mrs
	Interval int
}

// ProviderProxyGroup 描述一个 Provider 的代理组
type ProviderProxyGroup struct {
	Name    string        // Provider 名称（用作 proxy-provider 键名）
	Proxies []interface{} // 该 Provider 下的代理节点列表
}

// ParseProxiesFromContent 从订阅内容中解析 proxies 列表
func ParseProxiesFromContent(content string) ([]interface{}, error) {
	if content == "" {
		return nil, nil
	}

	var raw map[string]interface{}
	if err := yaml.Unmarshal([]byte(content), &raw); err != nil {
		return nil, fmt.Errorf("解析 YAML 失败: %w", err)
	}

	proxiesRaw, ok := raw["proxies"]
	if !ok {
		return nil, nil
	}

	proxies, ok := proxiesRaw.([]interface{})
	if !ok {
		return nil, nil
	}

	return proxies, nil
}

// PrefixProxies 为代理节点名称添加供应商前缀
func PrefixProxies(proxies []interface{}, providerName string) []interface{} {
	prefix := fmt.Sprintf("[%s] ", providerName)
	result := make([]interface{}, 0, len(proxies))

	for _, p := range proxies {
		pm, ok := p.(map[string]interface{})
		if !ok {
			result = append(result, p)
			continue
		}
		copied := make(map[string]interface{}, len(pm))
		for k, v := range pm {
			copied[k] = v
		}
		if name, ok := copied["name"].(string); ok {
			copied["name"] = prefix + name
		}
		result = append(result, copied)
	}
	return result
}

// ExpandCustomProxies 展开自定义代理节点列表
// type="custom" 的节点从 __raw__ 字段解析 YAML，其余直接使用
func ExpandCustomProxies(proxies []map[string]interface{}) []interface{} {
	result := make([]interface{}, 0, len(proxies))
	for _, p := range proxies {
		typ, _ := p["type"].(string)
		if strings.ToLower(typ) == "custom" {
			raw, _ := p["__raw__"].(string)
			if raw = strings.TrimSpace(raw); raw != "" {
				var parsed map[string]interface{}
				if err := yaml.Unmarshal([]byte(raw), &parsed); err == nil && parsed != nil {
					result = append(result, parsed)
					continue
				}
			}
			// 解析失败则跳过该节点
			continue
		}
		// 普通节点：去除 __raw__ 字段后直接使用
		clean := make(map[string]interface{}, len(p))
		for k, v := range p {
			if k != "__raw__" {
				clean[k] = v
			}
		}
		result = append(result, clean)
	}
	return result
}

// BuildMihomoConfig 构建完整的 mihomo 配置
//
// configTemplateContent: ConfigTemplate.Content（YAML 文本，顶层字段）
// providerGroups:        按 Provider 分组的代理节点
// subscriptionDialerProxy: 订阅级别的 dialer-proxy 目标（为空表示不设置）
// customProxies:         CustomConfig.Proxies（结构化，含 custom 类型）
// customGroups:          CustomConfig.ProxyGroups（结构化）
// customRules:           CustomConfig.Rules（字符串列表）
// ruleInsertMode:        prepend | append | replace（相对于模板内的 rules）
// ruleProviders:         需注入 rule-providers 的规则集列表
// providerNodeNames:     订阅源名称 → 该源的节点名列表（用于展开 use: 字段）
func BuildMihomoConfig(
	configTemplateContent string,
	providerGroups []ProviderProxyGroup,
	subscriptionDialerProxy string,
	customProxies []map[string]interface{},
	customGroups []map[string]interface{},
	customRules []string,
	ruleInsertMode string,
	ruleProviders []RuleProviderInput,
	providerNodeNames map[string][]string,
) ([]byte, error) {
	// 从 ConfigTemplate YAML 构建初始配置 map
	cfg := make(MihomoConfig)
	if configTemplateContent != "" {
		var tmplMap map[string]interface{}
		if err := yaml.Unmarshal([]byte(configTemplateContent), &tmplMap); err == nil && tmplMap != nil {
			for k, v := range tmplMap {
				cfg[k] = v
			}
		}
	}

	// 设置默认值
	setDefault(cfg, "mixed-port", 7890)
	setDefault(cfg, "allow-lan", false)
	setDefault(cfg, "mode", "rule")
	setDefault(cfg, "log-level", "info")

	// 合并所有代理节点：provider 节点（无订阅级 dialer-proxy）+ 自定义节点（无 dialer-proxy）
	// 带 dialer-proxy 的节点将被放入 proxy-providers (inline)
	normalProxies := make([]interface{}, 0)

	for _, pg := range providerGroups {
		if subscriptionDialerProxy == "" {
			normalProxies = append(normalProxies, pg.Proxies...)
		}
	}

	expandedCustom := ExpandCustomProxies(customProxies)
	// 将自定义节点也分为普通和带 dialer-proxy 两组
	normalCustom, dialerCustom := splitProxiesByDialer(expandedCustom)
	normalProxies = append(normalProxies, normalCustom...)
	cfg["proxies"] = normalProxies

	// 构建 dialer-proxy 的 proxy-providers
	dialerProviders := make(map[string]interface{})

	// 订阅级 dialer-proxy：所有 Provider 代理节点统一使用该 dialer-proxy
	if subscriptionDialerProxy != "" {
		for _, pg := range providerGroups {
			if len(pg.Proxies) > 0 {
				dialerProviders[pg.Name] = map[string]interface{}{
					"type":    "inline",
					"proxies": pg.Proxies,
					"override": map[string]interface{}{
						"dialer-proxy": subscriptionDialerProxy,
					},
				}
			}
		}
	}

	// 为有 dialer-proxy 的自定义节点构建 inline proxy-provider
	customDialerGroups := groupProxiesByDialerTarget(dialerCustom)
	for target, proxies := range customDialerGroups {
		key := fmt.Sprintf("dialer-%s", target)
		dialerProviders[key] = map[string]interface{}{
			"type":    "inline",
			"proxies": proxies,
			"override": map[string]interface{}{
				"dialer-proxy": target,
			},
		}
	}

	// 合并 dialer proxy-providers 到 cfg（与模板中已有的 proxy-providers 合并）
	if len(dialerProviders) > 0 {
		if raw, ok := cfg["proxy-providers"]; ok {
			if existing, ok := raw.(map[string]interface{}); ok {
				for k, v := range existing {
					dialerProviders[k] = v
				}
			}
		}
		cfg["proxy-providers"] = dialerProviders
	}

	// 写入 proxy-groups，并将 use: [providerName] 展开为具体节点名
	if len(customGroups) > 0 {
		groups := make([]interface{}, len(customGroups))
		for i, g := range customGroups {
			groups[i] = expandGroupUse(g, providerNodeNames)
		}
		cfg["proxy-groups"] = groups
	}

	// 提取模板中已有的 rules（在插入模式下作为"base rules"）
	var baseRules []string
	for _, key := range []string{"rules", "rule"} {
		if raw, ok := cfg[key]; ok {
			baseRules = rulesFromConfigValue(raw)
			delete(cfg, key)
			if len(baseRules) > 0 {
				break
			}
		}
	}

	// 构建 rule-providers map
	rpMap := buildRuleProvidersMap(ruleProviders)
	// 合并模板中已有的 rule-providers（用户覆盖优先）
	if raw, ok := cfg["rule-providers"]; ok {
		if existing, ok := raw.(map[string]interface{}); ok {
			for k, v := range existing {
				rpMap[k] = v
			}
		}
		delete(cfg, "rule-providers")
	}
	if len(rpMap) > 0 {
		cfg["rule-providers"] = rpMap
	}

	// 规则合并：baseRules → customRules（按 ruleInsertMode）
	finalRules := mergeRules(baseRules, customRules, ruleInsertMode)
	if len(finalRules) > 0 {
		cfg["rules"] = finalRules
	}

	return yaml.Marshal(cfg)
}

// expandGroupUse 将代理组中的 use:[providerName,...] 展开为具体节点名追加到 proxies 中
// 展开后从输出 map 里移除 use 字段，避免 Mihomo 找不到对应的 proxy-provider 报错
func expandGroupUse(g map[string]interface{}, providerNodeNames map[string][]string) map[string]interface{} {
	useRaw, hasUse := g["use"]
	if !hasUse || providerNodeNames == nil {
		return g
	}

	// 取出已有的 proxies 列表
	existing := toStringSlice(g["proxies"])

	// 按 use 中的每个 provider 名称展开节点
	switch u := useRaw.(type) {
	case []interface{}:
		for _, item := range u {
			name, _ := item.(string)
			if nodes, ok := providerNodeNames[name]; ok {
				existing = append(existing, nodes...)
			}
		}
	case []string:
		for _, name := range u {
			if nodes, ok := providerNodeNames[name]; ok {
				existing = append(existing, nodes...)
			}
		}
	}

	// 构造不含 use 字段的新 map
	out := make(map[string]interface{}, len(g))
	for k, v := range g {
		if k != "use" {
			out[k] = v
		}
	}
	if len(existing) > 0 {
		out["proxies"] = existing
	}
	return out
}

// toStringSlice 将 interface{} 类型的切片转为 []string
func toStringSlice(v interface{}) []string {
	if v == nil {
		return nil
	}
	switch s := v.(type) {
	case []string:
		return s
	case []interface{}:
		out := make([]string, 0, len(s))
		for _, item := range s {
			if str, ok := item.(string); ok {
				out = append(out, str)
			}
		}
		return out
	}
	return nil
}

// buildRuleProvidersMap 将 RuleProviderInput 列表转为 rule-providers map
func buildRuleProvidersMap(providers []RuleProviderInput) map[string]interface{} {
	if len(providers) == 0 {
		return make(map[string]interface{})
	}
	m := make(map[string]interface{}, len(providers))
	for _, rp := range providers {
		entry := map[string]interface{}{
			"type":     rp.Type,
			"behavior": rp.Behavior,
			"interval": rp.Interval,
			"path":     fmt.Sprintf("./ruleset/%s.yaml", rp.Name),
		}
		if rp.URL != "" {
			entry["url"] = rp.URL
		}
		if rp.Format != "" && rp.Format != "yaml" {
			entry["format"] = rp.Format
		}
		m[rp.Name] = entry
	}
	return m
}

// rulesFromConfigValue 将 config map 中取出的 rules/rule 值转为字符串列表
func rulesFromConfigValue(v interface{}) []string {
	if v == nil {
		return nil
	}
	switch x := v.(type) {
	case []string:
		return filterEmptyStrings(x)
	case []interface{}:
		out := make([]string, 0, len(x))
		for _, it := range x {
			if s, ok := it.(string); ok {
				out = append(out, s)
			}
		}
		return filterEmptyStrings(out)
	default:
		return nil
	}
}

// mergeRules 根据插入模式合并规则
func mergeRules(baseRules, customRules []string, mode string) []string {
	switch mode {
	case "replace":
		return customRules
	case "append":
		combined := make([]string, 0, len(baseRules)+len(customRules))
		combined = append(combined, baseRules...)
		combined = append(combined, customRules...)
		return combined
	default: // prepend
		combined := make([]string, 0, len(customRules)+len(baseRules))
		combined = append(combined, customRules...)
		combined = append(combined, baseRules...)
		return combined
	}
}

// ParseYAMLList 将 YAML 格式的数组文本解析为 []interface{}（兼容旧逻辑，保留备用）
func ParseYAMLList(yamlText string) ([]interface{}, error) {
	if strings.TrimSpace(yamlText) == "" {
		return nil, nil
	}

	var list []interface{}
	if err := yaml.Unmarshal([]byte(yamlText), &list); err != nil {
		return nil, err
	}
	return list, nil
}

// ParseRulesList 将 YAML 或换行分隔的规则文本解析为字符串列表（兼容旧逻辑，保留备用）
func ParseRulesList(rulesText string) []string {
	if strings.TrimSpace(rulesText) == "" {
		return nil
	}

	var list []string
	if err := yaml.Unmarshal([]byte(rulesText), &list); err == nil && len(list) > 0 {
		return filterEmptyStrings(list)
	}

	lines := strings.Split(rulesText, "\n")
	return filterEmptyStrings(lines)
}

func filterEmptyStrings(s []string) []string {
	result := make([]string, 0, len(s))
	for _, v := range s {
		v = strings.TrimSpace(v)
		if v != "" && !strings.HasPrefix(v, "#") {
			result = append(result, v)
		}
	}
	return result
}

func setDefault(m map[string]interface{}, key string, value interface{}) {
	if _, exists := m[key]; !exists {
		m[key] = value
	}
}

// splitProxiesByDialer 将代理节点按是否含有 dialer-proxy 字段分为两组
func splitProxiesByDialer(proxies []interface{}) (normal []interface{}, withDialer []interface{}) {
	for _, p := range proxies {
		pm, ok := p.(map[string]interface{})
		if !ok {
			normal = append(normal, p)
			continue
		}
		if dp, exists := pm["dialer-proxy"]; exists && dp != "" {
			withDialer = append(withDialer, p)
		} else {
			normal = append(normal, p)
		}
	}
	return
}

// groupProxiesByDialerTarget 将带 dialer-proxy 的代理按目标值分组
func groupProxiesByDialerTarget(proxies []interface{}) map[string][]interface{} {
	groups := make(map[string][]interface{})
	for _, p := range proxies {
		pm, ok := p.(map[string]interface{})
		if !ok {
			continue
		}
		target, _ := pm["dialer-proxy"].(string)
		if target != "" {
			// 移除代理中的 dialer-proxy 字段（由 proxy-provider override 设置）
			cleaned := make(map[string]interface{}, len(pm))
			for k, v := range pm {
				if k != "dialer-proxy" {
					cleaned[k] = v
				}
			}
			groups[target] = append(groups[target], cleaned)
		}
	}
	return groups
}
