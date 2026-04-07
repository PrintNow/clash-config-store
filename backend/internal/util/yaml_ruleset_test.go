package util

import (
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

// TestBuildMihomoConfig_RuleProviders 验证 rule-providers 注入逻辑
func TestBuildMihomoConfig_RuleProviders(t *testing.T) {
	providers := []RuleProviderInput{
		{Name: "reject", Type: "http", URL: "https://example.com/reject.txt", Behavior: "domain", Format: "text", Interval: 86400},
		{Name: "proxy", Type: "http", URL: "https://example.com/proxy.txt", Behavior: "domain", Format: "text", Interval: 86400},
	}
	customRules := []string{"RULE-SET,reject,REJECT", "RULE-SET,proxy,PROXY", "MATCH,DIRECT"}
	out, err := BuildMihomoConfig("", nil, nil, nil, customRules, "append", providers, nil)
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

// TestBuildMihomoConfig_CustomProxiesExpand 验证 type=custom 的 __raw__ 展开
func TestBuildMihomoConfig_CustomProxiesExpand(t *testing.T) {
	customProxies := []map[string]interface{}{
		{
			"name": "home",
			"type": "custom",
			"__raw__": `name: home
type: ss
server: 1.2.3.4
port: 8388
cipher: aes-256-gcm
password: test`,
		},
		{"name": "office", "type": "socks5", "server": "10.0.0.1", "port": 1080},
	}
	out, err := BuildMihomoConfig("", nil, customProxies, nil, nil, "append", nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	var cfg map[string]interface{}
	if err := yaml.Unmarshal(out, &cfg); err != nil {
		t.Fatal(err)
	}
	proxies, ok := cfg["proxies"].([]interface{})
	if !ok || len(proxies) != 2 {
		t.Fatalf("期望 2 个代理，得到: %v", proxies)
	}
	p0, _ := proxies[0].(map[string]interface{})
	if p0["type"] != "ss" {
		t.Fatalf("第一个代理类型期望 ss，得到 %v", p0["type"])
	}
}

// TestBuildMihomoConfig_TemplateRulesMerge 验证 ConfigTemplate 中的 rules 与自定义规则合并
func TestBuildMihomoConfig_TemplateRulesMerge(t *testing.T) {
	tmpl := `
mixed-port: 7890
rules:
  - IP-CIDR,10.0.0.0/8,DIRECT
`
	customRules := []string{"DOMAIN-SUFFIX,google.com,PROXY"}
	out, err := BuildMihomoConfig(tmpl, nil, nil, nil, customRules, "prepend", nil, nil)
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

// TestBuildMihomoConfig_TemplateRuleProvidersMerge 验证模板中已有 rule-providers 与注入的合并
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
	out, err := BuildMihomoConfig(tmpl, nil, nil, nil, nil, "append", providers, nil)
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

// TestBuildMihomoConfig_UseExpand 验证 proxy-group 中 use:[providerName] 展开为节点名
func TestBuildMihomoConfig_UseExpand(t *testing.T) {
	// 模拟一个订阅源有 3 个节点（已带前缀）
	providerNodes := map[string][]string{
		"机场A": {"[机场A] 香港01", "[机场A] 日本01", "[机场A] 美国01"},
	}

	customGroups := []map[string]interface{}{
		{
			"name": "🚀 节点选择",
			"type": "select",
			// proxies 里有固定项，use 里引用机场A
			"proxies": []interface{}{"DIRECT", "REJECT"},
			"use":     []interface{}{"机场A"},
		},
		{
			// 只有 use，没有 proxies
			"name": "♻️ 自动选择",
			"type": "url-test",
			"use":  []interface{}{"机场A"},
			"url":  "http://www.gstatic.com/generate_204",
		},
	}

	out, err := BuildMihomoConfig("", nil, nil, customGroups, nil, "append", nil, providerNodes)
	if err != nil {
		t.Fatal(err)
	}
	var cfg map[string]interface{}
	_ = yaml.Unmarshal(out, &cfg)

	groups, _ := cfg["proxy-groups"].([]interface{})
	if len(groups) != 2 {
		t.Fatalf("期望 2 个代理组，得到 %d", len(groups))
	}

	// 第一个组：DIRECT + REJECT + 3 个展开节点 = 5
	g0, _ := groups[0].(map[string]interface{})
	p0 := toStringSlice(g0["proxies"])
	if len(p0) != 5 {
		t.Fatalf("第一个组期望 5 个成员（2+3），得到 %d: %v", len(p0), p0)
	}
	// 不应再有 use 字段
	if _, hasUse := g0["use"]; hasUse {
		t.Fatal("展开后 use 字段应被移除")
	}

	// 第二个组：仅来自机场A的 3 个节点
	g1, _ := groups[1].(map[string]interface{})
	p1 := toStringSlice(g1["proxies"])
	if len(p1) != 3 {
		t.Fatalf("第二个组期望 3 个成员，得到 %d: %v", len(p1), p1)
	}
	if p1[0] != "[机场A] 香港01" {
		t.Fatalf("节点名不符，得到 %q", p1[0])
	}
}
