package util

import (
	"encoding/json"
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

// MihomoConfig 表示完整的 mihomo 配置文件结构（使用 map 保持灵活性）
type MihomoConfig map[string]interface{}

// ParseProxiesFromContent 从订阅内容中解析 proxies 列表
// 支持标准的 Clash/Mihomo YAML 格式
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

// PrefixProxies 为代理节点名称添加供应商前缀，同时更新 proxy-groups 引用
func PrefixProxies(proxies []interface{}, providerName string) []interface{} {
	prefix := fmt.Sprintf("[%s] ", providerName)
	result := make([]interface{}, 0, len(proxies))

	for _, p := range proxies {
		pm, ok := p.(map[string]interface{})
		if !ok {
			result = append(result, p)
			continue
		}
		// 深拷贝避免修改原始数据
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

// ParseRulesList 将 YAML 或换行分隔的规则文本解析为字符串列表
func ParseRulesList(rulesText string) []string {
	if strings.TrimSpace(rulesText) == "" {
		return nil
	}

	var list []string
	// 先尝试 YAML 列表格式
	if err := yaml.Unmarshal([]byte(rulesText), &list); err == nil && len(list) > 0 {
		return filterEmptyStrings(list)
	}

	// 降级为按行解析
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

// BuildMihomoConfig 构建完整的 mihomo 配置
// baseConfigJSON: 顶层基础配置（JSON 格式）
// allProxies: 合并后的所有代理节点
// proxyGroupsYAML: 自定义 proxy-groups YAML 文本
// upstreamRules: 上游规则列表（可为空）
// customRules: 自定义规则列表
// ruleInsertMode: prepend / append / replace
func BuildMihomoConfig(
	baseConfigJSON string,
	allProxies []interface{},
	proxyGroupsYAML string,
	customRules []string,
	ruleInsertMode string,
) ([]byte, error) {
	// 从 base_config JSON 构建初始配置 map
	cfg := make(MihomoConfig)
	if baseConfigJSON != "" {
		var baseMap map[string]interface{}
		if err := json.Unmarshal([]byte(baseConfigJSON), &baseMap); err == nil {
			for k, v := range baseMap {
				cfg[k] = v
			}
		}
	}

	// 设置默认值（如果 base_config 没有提供）
	setDefault(cfg, "mixed-port", 7890)
	setDefault(cfg, "allow-lan", false)
	setDefault(cfg, "mode", "rule")
	setDefault(cfg, "log-level", "info")

	// 写入 proxies
	cfg["proxies"] = allProxies

	// 写入 proxy-groups
	if proxyGroupsYAML != "" {
		groups, err := ParseYAMLList(proxyGroupsYAML)
		if err == nil && groups != nil {
			cfg["proxy-groups"] = groups
		}
	}

	// 处理规则
	finalRules := mergeRules(nil, customRules, ruleInsertMode)
	if len(finalRules) > 0 {
		cfg["rules"] = finalRules
	}

	return yaml.Marshal(cfg)
}

// mergeRules 根据插入模式合并规则
func mergeRules(upstreamRules, customRules []string, mode string) []string {
	switch mode {
	case "replace":
		return customRules
	case "append":
		combined := make([]string, 0, len(upstreamRules)+len(customRules))
		combined = append(combined, upstreamRules...)
		combined = append(combined, customRules...)
		return combined
	default: // prepend
		combined := make([]string, 0, len(customRules)+len(upstreamRules))
		combined = append(combined, customRules...)
		combined = append(combined, upstreamRules...)
		return combined
	}
}

func setDefault(m map[string]interface{}, key string, value interface{}) {
	if _, exists := m[key]; !exists {
		m[key] = value
	}
}
