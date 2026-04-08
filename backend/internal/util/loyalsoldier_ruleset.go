package util

// loyalsoldier_ruleset.go 保留工具函数供参考/文档，
// 实际 rule-provider 条目已通过 repository.SeedRuleProviders 写入数据库。

// LoyalsoldierRuleFiles 返回 Loyalsoldier 规则集文件名列表及对应 behavior
// 可用于前端展示或动态生成默认配置
func LoyalsoldierRuleFiles() []struct {
	Name     string
	Behavior string
} {
	return []struct {
		Name     string
		Behavior string
	}{
		{"reject", "domain"},
		{"icloud", "domain"},
		{"apple", "domain"},
		{"google", "domain"},
		{"proxy", "domain"},
		{"direct", "domain"},
		{"private", "domain"},
		{"gfw", "domain"},
		{"tld-not-cn", "domain"},
		{"telegramcidr", "ipcidr"},
		{"cncidr", "ipcidr"},
		{"lancidr", "ipcidr"},
		{"applications", "classical"},
	}
}
