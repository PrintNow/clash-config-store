package util

import (
	"fmt"
	"strings"
)

// mihomo 支持的规则类型前缀
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

var ruleTypesCommaInPayload = map[string]struct{}{
	"NOT": {}, "OR": {}, "AND": {}, "SUB-RULE": {},
	"DOMAIN-REGEX": {}, "PROCESS-NAME-REGEX": {}, "PROCESS-PATH-REGEX": {},
}

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

// validateMihomoRuleLine 校验单条规则行能否被 mihomo 解析
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

// ValidateMihomoRuleLine 校验单条规则行（公开导出版本）
func ValidateMihomoRuleLine(line string) error {
	return validateMihomoRuleLine(line)
}
