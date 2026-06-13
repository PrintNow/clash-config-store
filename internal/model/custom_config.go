package model

// CustomConfig 用户自定义代理组、规则（结构化存储）
// 代理节点由 inline Provider 承载，不再直接存储于此结构。
type CustomConfig struct {
	Base
	UserID uint   `gorm:"not null;index" json:"user_id"`
	Name   string `gorm:"not null" json:"name"`

	// ProxyGroups 代理组列表（JSON 序列化的 []map[string]interface{}）
	ProxyGroups []map[string]interface{} `gorm:"serializer:json;type:longtext" json:"proxy_groups"`

	// Rules 规则行列表（JSON 序列化的 []string）
	Rules []string `gorm:"serializer:json;type:longtext" json:"rules"`

	// RuleProviderIDs 引用的外部规则集 ID 列表（JSON 序列化的 []uint）
	RuleProviderIDs []uint `gorm:"serializer:json;type:longtext" json:"rule_provider_ids"`

	// HostedRuleSetIDs 引用的托管规则集 ID 列表（JSON 序列化的 []uint）
	HostedRuleSetIDs []uint `gorm:"serializer:json;type:longtext" json:"hosted_rule_set_ids"`

	User User `gorm:"foreignKey:UserID" json:"-"`
}
