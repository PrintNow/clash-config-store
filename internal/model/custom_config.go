package model

// CustomConfig 用户自定义代理节点、代理组、规则（结构化存储）
// 三个核心字段均以 JSON 数组存储，支持前端表单化编辑
type CustomConfig struct {
	Base
	UserID uint   `gorm:"not null;index" json:"user_id"`
	Name   string `gorm:"not null" json:"name"`

	// Proxies 代理节点列表（JSON 序列化的 []map[string]interface{}）
	// 每项含 name/type 及协议特有字段；type="custom" 时含 __raw__ YAML 片段
	Proxies []map[string]interface{} `gorm:"serializer:json;type:longtext" json:"proxies"`

	// ProxyGroups 代理组列表（JSON 序列化的 []map[string]interface{}）
	// 每项含 name/type/proxies/use 等字段
	ProxyGroups []map[string]interface{} `gorm:"serializer:json;type:longtext" json:"proxy_groups"`

	// Rules 规则行列表（JSON 序列化的 []string）
	Rules []string `gorm:"serializer:json;type:longtext" json:"rules"`

	// RuleProviderIDs 引用的规则集 ID 列表（JSON 序列化的 []uint）
	RuleProviderIDs []uint `gorm:"serializer:json;type:longtext" json:"rule_provider_ids"`

	User User `gorm:"foreignKey:UserID" json:"-"`
}
