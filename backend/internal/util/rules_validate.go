package util

import (
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

// mihomo 支持的规则类型前缀（与 rules/parser.go switch 对齐，便于尽早拦截拼写错误）
var mihomoRuleTypes = map[string]struct{}{
	"DOMAIN":                {},
	"DOMAIN-SUFFIX":         {},
	"DOMAIN-KEYWORD":        {},
	"DOMAIN-REGEX":          {},
	"DOMAIN-WILDCARD":       {},
	"GEOSITE":               {},
	"GEOIP":                 {},
	"SRC-GEOIP":             {},
	"IP-ASN":                {},
	"SRC-IP-ASN":            {},
	"IP-CIDR":               {},
	"IP-CIDR6":              {},
	"SRC-IP-CIDR":           {},
	"IP-SUFFIX":             {},
	"SRC-IP-SUFFIX":         {},
	"SRC-PORT":              {},
	"DST-PORT":              {},
	"IN-PORT":               {},
	"DSCP":                  {},
	"PROCESS-NAME":          {},
	"PROCESS-PATH":          {},
	"PROCESS-NAME-REGEX":    {},
	"PROCESS-PATH-REGEX":    {},
	"PROCESS-NAME-WILDCARD": {},
	"PROCESS-PATH-WILDCARD": {},
	"NETWORK":               {},
	"UID":                   {},
	"IN-TYPE":               {},
	"IN-USER":               {},
	"IN-NAME":               {},
	"SUB-RULE":              {},
	"AND":                   {},
	"OR":                    {},
	"NOT":                   {},
	"RULE-SET":              {},
	"MATCH":                 {},
}

// payload 中可含逗号、由 ParseRulePayload 特殊处理的类型（target 固定取最后一节）
var ruleTypesCommaInPayload = map[string]struct{}{
	"NOT": {}, "OR": {}, "AND": {}, "SUB-RULE": {},
	"DOMAIN-REGEX": {}, "PROCESS-NAME-REGEX": {}, "PROCESS-PATH-REGEX": {},
}

// parseRulePayload 与 mihomo rules/common/base.go ParseRulePayload 行为一致（needTarget=true）
func parseRulePayload(ruleRaw string, needTarget bool) (tp, payload, target string, params []string) {
	item := trimSplitComma(ruleRaw)
	if len(item) == 0 {
		return "", "", "", nil
	}
	tp = strings.ToUpper(strings.TrimSpace(item[0]))
	if len(item) <= 1 {
		return tp, "", "", nil
	}
	switch tp {
	case "MATCH":
		target = strings.TrimSpace(item[1])
	case "NOT", "OR", "AND", "SUB-RULE", "DOMAIN-REGEX", "PROCESS-NAME-REGEX", "PROCESS-PATH-REGEX":
		if needTarget {
			l := len(item)
			target = strings.TrimSpace(item[l-1])
			item = item[:l-1]
		}
		payload = strings.Join(trimItemSlice(item[1:]), ",")
	default:
		payload = strings.TrimSpace(item[1])
		if len(item) > 2 {
			if needTarget {
				target = strings.TrimSpace(item[2])
				if len(item) > 3 {
					params = trimItemSlice(item[3:])
				}
			} else {
				params = trimItemSlice(item[2:])
			}
		}
	}
	return
}

func trimSplitComma(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, e := range parts {
		out = append(out, strings.TrimSpace(e))
	}
	return out
}

func trimItemSlice(item []string) []string {
	r := make([]string, len(item))
	for i, e := range item {
		r[i] = strings.TrimSpace(e)
	}
	return r
}

// validateMihomoRuleLine 校验单条规则行能否被 mihomo 解析（不依赖 mihomo 模块）
func validateMihomoRuleLine(line string) error {
	line = strings.TrimSpace(line)
	if line == "" {
		return fmt.Errorf("存在空规则行")
	}
	tp, payload, target, _ := parseRulePayload(line, true)
	if tp == "" {
		return fmt.Errorf("规则缺少类型: %q", line)
	}
	if _, ok := mihomoRuleTypes[tp]; !ok {
		return fmt.Errorf("不支持的规则类型 %q: %q", tp, line)
	}
	if tp != "MATCH" && payload == "" {
		return fmt.Errorf("规则 %s 缺少参数: %q", tp, line)
	}
	if _, heavy := ruleTypesCommaInPayload[tp]; heavy {
		if target == "" {
			return fmt.Errorf("规则 %s 缺少策略（target）: %q", tp, line)
		}
		return nil
	}
	if tp == "MATCH" {
		if target == "" {
			return fmt.Errorf("MATCH 规则缺少策略: %q", line)
		}
		return nil
	}
	if target == "" {
		return fmt.Errorf("规则 %s 缺少策略: %q", tp, line)
	}
	return nil
}

// rulesInputUsesYAMLListSyntax 是否为 YAML 流式数组或块序列列表（与 ParseRulesList 触发 YAML 分支的条件对齐）
func rulesInputUsesYAMLListSyntax(s string) bool {
	t := strings.TrimSpace(s)
	if strings.HasPrefix(t, "[") {
		return true
	}
	for _, line := range strings.Split(s, "\n") {
		u := strings.TrimSpace(line)
		if u == "" || strings.HasPrefix(u, "#") {
			continue
		}
		return strings.HasPrefix(u, "-")
	}
	return false
}

// extractRulesLinesForValidation 解析规则文本为行列表；YAML 列表格式要求合法且每项为非空字符串
func extractRulesLinesForValidation(text string) ([]string, error) {
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, nil
	}
	if rulesInputUsesYAMLListSyntax(text) {
		var list []string
		if err := yaml.Unmarshal([]byte(text), &list); err != nil {
			return nil, fmt.Errorf("规则 YAML 列表解析失败: %w", err)
		}
		out := make([]string, 0, len(list))
		for i, s := range list {
			s = strings.TrimSpace(s)
			if s == "" {
				return nil, fmt.Errorf("规则列表第 %d 项为空", i+1)
			}
			out = append(out, s)
		}
		return out, nil
	}
	lines := strings.Split(text, "\n")
	for _, line := range lines {
		t := strings.TrimSpace(line)
		if t == "" || strings.HasPrefix(t, "#") {
			continue
		}
		if strings.HasPrefix(t, "-") {
			return nil, fmt.Errorf("按行书写规则时不要使用行首 \"- \"，请改为整块 YAML 列表或去掉 \"- \"")
		}
	}
	return filterEmptyStrings(lines), nil
}

// ValidateCustomConfigRules 校验自定义配置中的 rules 字段
func ValidateCustomConfigRules(rulesText string) error {
	lines, err := extractRulesLinesForValidation(rulesText)
	if err != nil {
		return err
	}
	for i, line := range lines {
		if err := validateMihomoRuleLine(line); err != nil {
			return fmt.Errorf("第 %d 条规则: %w", i+1, err)
		}
	}
	return nil
}

// 需要 proxies 数组的代理组类型（mihomo）
var proxyGroupTypesNeedProxies = map[string]struct{}{
	"select": {}, "url-test": {}, "fallback": {}, "load-balance": {}, "relay": {},
}

// ValidateCustomConfigProxies 校验 proxies YAML 片段（数组项须为对象且含 name、type）
func ValidateCustomConfigProxies(proxiesYAML string) error {
	s := strings.TrimSpace(proxiesYAML)
	if s == "" {
		return nil
	}
	list, err := ParseYAMLList(proxiesYAML)
	if err != nil {
		return fmt.Errorf("proxies YAML 解析失败: %w", err)
	}
	for i, it := range list {
		m, ok := it.(map[string]interface{})
		if !ok {
			return fmt.Errorf("proxies 第 %d 项须为对象", i+1)
		}
		name, _ := m["name"].(string)
		if strings.TrimSpace(name) == "" {
			return fmt.Errorf("proxies 第 %d 项缺少非空 name", i+1)
		}
		typ, _ := m["type"].(string)
		if strings.TrimSpace(typ) == "" {
			return fmt.Errorf("proxies 第 %d 项缺少非空 type", i+1)
		}
	}
	return nil
}

// ValidateCustomConfigProxyGroups 校验 proxy-groups YAML 片段
func ValidateCustomConfigProxyGroups(proxyGroupsYAML string) error {
	s := strings.TrimSpace(proxyGroupsYAML)
	if s == "" {
		return nil
	}
	list, err := ParseYAMLList(proxyGroupsYAML)
	if err != nil {
		return fmt.Errorf("proxy-groups YAML 解析失败: %w", err)
	}
	for i, it := range list {
		m, ok := it.(map[string]interface{})
		if !ok {
			return fmt.Errorf("proxy-groups 第 %d 项须为对象", i+1)
		}
		name, _ := m["name"].(string)
		if strings.TrimSpace(name) == "" {
			return fmt.Errorf("proxy-groups 第 %d 项缺少非空 name", i+1)
		}
		typ, _ := m["type"].(string)
		typ = strings.TrimSpace(strings.ToLower(typ))
		if typ == "" {
			return fmt.Errorf("proxy-groups 第 %d 项缺少非空 type", i+1)
		}
		if _, need := proxyGroupTypesNeedProxies[typ]; need {
			raw, ok := m["proxies"]
			if !ok {
				return fmt.Errorf("proxy-groups 第 %d 项（%s）缺少 proxies 列表", i+1, typ)
			}
			if _, ok := raw.([]interface{}); !ok {
				return fmt.Errorf("proxy-groups 第 %d 项（%s）的 proxies 须为数组", i+1, typ)
			}
		}
	}
	return nil
}

// ValidateCustomConfigPayload 校验自定义配置三字段，在写入 DB 前调用
func ValidateCustomConfigPayload(proxies, proxyGroups, rules string) error {
	if err := ValidateCustomConfigProxies(proxies); err != nil {
		return err
	}
	if err := ValidateCustomConfigProxyGroups(proxyGroups); err != nil {
		return err
	}
	if err := ValidateCustomConfigRules(rules); err != nil {
		return err
	}
	return nil
}
