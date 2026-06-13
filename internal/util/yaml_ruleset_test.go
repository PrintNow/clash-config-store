package util

import (
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

func TestBuildMihomoConfig_RuleProviders(t *testing.T) {
	providers := []RuleProviderInput{
		{Name: "reject", Type: "http", URL: "https://example.com/reject.txt", Behavior: "domain", Format: "text", Interval: 86400},
		{Name: "proxy", Type: "http", URL: "https://example.com/proxy.txt", Behavior: "domain", Format: "text", Interval: 86400},
	}
	customRules := []string{"RULE-SET,reject,REJECT", "RULE-SET,proxy,PROXY", "MATCH,DIRECT"}
	out, err := BuildMihomoConfig("", nil, nil, customRules, "append", providers, nil)
	if err != nil {
		t.Fatal(err)
	}
	var cfg map[string]interface{}
	if err := yaml.Unmarshal(out, &cfg); err != nil {
		t.Fatal(err)
	}
	rp, ok := cfg["rule-providers"].(map[string]interface{})
	if !ok || len(rp) != 2 {
		t.Fatalf("rule-providers 期望 2 项，得到: %v", rp)
	}
	rules, ok := cfg["rules"].([]interface{})
	if !ok || len(rules) != 3 {
		t.Fatalf("rules 期望 3 条，得到: %v", rules)
	}
}

func TestBuildMihomoConfig_TemplateRulesMerge(t *testing.T) {
	tmpl := `
mixed-port: 7890
rules:
  - IP-CIDR,10.0.0.0/8,DIRECT
`
	customRules := []string{"DOMAIN-SUFFIX,google.com,PROXY"}
	out, err := BuildMihomoConfig(tmpl, nil, nil, customRules, "prepend", nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	var cfg map[string]interface{}
	_ = yaml.Unmarshal(out, &cfg)
	rules, _ := cfg["rules"].([]interface{})
	if len(rules) != 2 {
		t.Fatalf("期望 2 条规则，得到 %d: %v", len(rules), rules)
	}
	first, _ := rules[0].(string)
	if !strings.Contains(first, "google.com") {
		t.Fatalf("prepend 模式首条应为自定义规则，得到 %q", first)
	}
}

func TestBuildMihomoConfig_TemplateRuleProvidersMerge(t *testing.T) {
	tmpl := `
rule-providers:
  my-custom:
    type: http
    behavior: domain
    url: https://custom.example.com/rules.txt
    interval: 3600
`
	providers := []RuleProviderInput{
		{Name: "reject", Type: "http", URL: "https://example.com/reject.txt", Behavior: "domain", Interval: 86400},
	}
	out, err := BuildMihomoConfig(tmpl, nil, nil, nil, "append", providers, nil)
	if err != nil {
		t.Fatal(err)
	}
	var cfg map[string]interface{}
	_ = yaml.Unmarshal(out, &cfg)
	rp, _ := cfg["rule-providers"].(map[string]interface{})
	if len(rp) != 2 {
		t.Fatalf("期望 2 个 rule-provider（模板 1 + 注入 1），得到 %d: %v", len(rp), rp)
	}
}

func TestBuildMihomoConfig_UseExpand(t *testing.T) {
	providerNodes := map[string][]string{
		"机场A": {"[机场A] 香港01", "[机场A] 日本01", "[机场A] 美国01"},
	}
	customGroups := []map[string]interface{}{
		{
			"name":    "🚀 节点选择",
			"type":    "select",
			"proxies": []interface{}{"DIRECT", "REJECT"},
			"use":     []interface{}{"机场A"},
		},
		{
			"name": "♻️ 自动选择",
			"type": "url-test",
			"use":  []interface{}{"机场A"},
			"url":  "http://www.gstatic.com/generate_204",
		},
	}
	out, err := BuildMihomoConfig("", nil, customGroups, nil, "append", nil, providerNodes)
	if err != nil {
		t.Fatal(err)
	}
	var cfg map[string]interface{}
	_ = yaml.Unmarshal(out, &cfg)

	groups, _ := cfg["proxy-groups"].([]interface{})
	if len(groups) != 2 {
		t.Fatalf("期望 2 个代理组，得到 %d", len(groups))
	}

	g0, _ := groups[0].(map[string]interface{})
	p0 := toStringSlice(g0["proxies"])
	if len(p0) != 5 {
		t.Fatalf("第一个组期望 5 个成员（2+3），得到 %d: %v", len(p0), p0)
	}
	if _, hasUse := g0["use"]; hasUse {
		t.Fatal("展开后 use 字段应被移除")
	}

	g1, _ := groups[1].(map[string]interface{})
	p1 := toStringSlice(g1["proxies"])
	if len(p1) != 3 {
		t.Fatalf("第二个组期望 3 个成员，得到 %d: %v", len(p1), p1)
	}
	if p1[0] != "[机场A] 香港01" {
		t.Fatalf("节点名不符，得到 %q", p1[0])
	}
}
