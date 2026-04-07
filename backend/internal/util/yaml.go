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
// providerProxies:       来自订阅源的代理节点（已处理前缀）
// customProxies:         CustomConfig.Proxies（结构化，含 custom 类型）
// customGroups:          CustomConfig.ProxyGroups（结构化）
// customRules:           CustomConfig.Rules（字符串列表）
// ruleInsertMode:        prepend | append | replace（相对于模板内的 rules）
// ruleProviders:         需注入 rule-providers 的规则集列表
func BuildMihomoConfig(
	configTemplateContent string,
	providerProxies []interface{},
	customProxies []map[string]interface{},
	customGroups []map[string]interface{},
	customRules []string,
	ruleInsertMode string,
	ruleProviders []RuleProviderInput,
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

	// 合并所有代理节点：provider 节点 + 自定义节点
	expandedCustom := ExpandCustomProxies(customProxies)
	allProxies := make([]interface{}, 0, len(providerProxies)+len(expandedCustom))
	allProxies = append(allProxies, providerProxies...)
	allProxies = append(allProxies, expandedCustom...)
	cfg["proxies"] = allProxies

	// 写入 proxy-groups（结构化 JSON 直接转 interface 列表）
	if len(customGroups) > 0 {
		groups := make([]interface{}, len(customGroups))
		for i, g := range customGroups {
			groups[i] = g
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
