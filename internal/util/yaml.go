package util

import (
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

// MihomoConfig 表示完整的 mihomo 配置文件结构（使用 map 保持灵活性）
type MihomoConfig map[string]interface{}

// RuleProviderInput BuildMihomoConfig 接收的规则集描述
type RuleProviderInput struct {
	Name     string // 在 rule-providers 中的键名，RULE-SET 规则引用此名
	Type     string // http | file
	URL      string
	Behavior string // domain | ipcidr | classical
	Format   string // yaml | text | mrs
	Interval int
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

// BuildMihomoConfig 构建完整的 mihomo 配置
//
// configTemplateContent: ConfigTemplate.Content（YAML 文本，顶层字段）
// providerProxies:       来自订阅源的代理节点（已处理前缀）
// customGroups:          CustomConfig.ProxyGroups（结构化）
// customRules:           CustomConfig.Rules（字符串列表）
// ruleInsertMode:        prepend | append | replace（相对于模板内的 rules）
// ruleProviders:         需注入 rule-providers 的规则集列表
// providerNodeNames:     订阅源名称 → 该源的节点名列表（用于展开 use: 字段）
func BuildMihomoConfig(
	configTemplateContent string,
	providerProxies []interface{},
	customGroups []map[string]interface{},
	customRules []string,
	ruleInsertMode string,
	ruleProviders []RuleProviderInput,
	providerNodeNames map[string][]string,
) ([]byte, error) {
	cfg := make(MihomoConfig)
	if configTemplateContent != "" {
		var tmplMap map[string]interface{}
		if err := yaml.Unmarshal([]byte(configTemplateContent), &tmplMap); err == nil && tmplMap != nil {
			for k, v := range tmplMap {
				cfg[k] = v
			}
		}
	}

	setDefault(cfg, "mixed-port", 7890)
	setDefault(cfg, "allow-lan", false)
	setDefault(cfg, "mode", "rule")
	setDefault(cfg, "log-level", "info")

	cfg["proxies"] = providerProxies

	if len(customGroups) > 0 {
		groups := make([]interface{}, len(customGroups))
		for i, g := range customGroups {
			groups[i] = expandGroupUse(g, providerNodeNames)
		}
		cfg["proxy-groups"] = groups
	}

	// 提取模板中已有的 rules
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

	// 构建 rule-providers map，模板中已有的用户覆盖优先
	rpMap := buildRuleProvidersMap(ruleProviders)
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

	finalRules := mergeRules(baseRules, customRules, ruleInsertMode)
	if len(finalRules) > 0 {
		cfg["rules"] = finalRules
	}

	return yaml.Marshal(cfg)
}

// expandGroupUse 将代理组中的 use:[providerName,...] 展开为具体节点名追加到 proxies 中
// 展开后移除 use 字段，避免 Mihomo 找不到对应的 proxy-provider 报错
func expandGroupUse(g map[string]interface{}, providerNodeNames map[string][]string) map[string]interface{} {
	useRaw, hasUse := g["use"]
	if !hasUse || providerNodeNames == nil {
		return g
	}
	existing := toStringSlice(g["proxies"])
	switch u := useRaw.(type) {
	case []interface{}:
		for _, item := range u {
			if name, _ := item.(string); name != "" {
				existing = append(existing, providerNodeNames[name]...)
			}
		}
	case []string:
		for _, name := range u {
			existing = append(existing, providerNodeNames[name]...)
		}
	}
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

// ParseYAMLList 将 YAML 格式的数组文本解析为 []interface{}
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

func buildRuleProvidersMap(providers []RuleProviderInput) map[string]interface{} {
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
	}
	return nil
}

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
