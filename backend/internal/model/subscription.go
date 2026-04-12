package model

import "time"

// RuleInsertMode 自定义规则插入位置
type RuleInsertMode string

const (
	RuleInsertPrepend RuleInsertMode = "prepend" // 自定义规则放前面
	RuleInsertAppend  RuleInsertMode = "append"  // 自定义规则放后面
	RuleInsertReplace RuleInsertMode = "replace" // 仅使用自定义规则
)

// Subscription 输出订阅配置
type Subscription struct {
	Base
	UserID             uint           `gorm:"not null;index" json:"user_id"`
	Name               string         `gorm:"not null" json:"name"`
	Token              string         `gorm:"uniqueIndex;not null" json:"token"`
	TokenExpiredAt     *time.Time     `json:"token_expired_at"`
	EnabledProviderIDs string         `gorm:"type:longtext" json:"enabled_provider_ids"` // JSON 编码的 []uint
	CustomConfigID     *uint          `json:"custom_config_id"`
	// ConfigTemplateID 引用可复用的顶层配置模板（替代内联 BaseConfig）
	ConfigTemplateID   *uint          `json:"config_template_id"`
	RuleInsertMode     RuleInsertMode `gorm:"default:'prepend'" json:"rule_insert_mode"`
	ProxyPrefixEnabled bool           `gorm:"default:true" json:"proxy_prefix_enabled"`
	// 仅 JSON 输出，由 handler 根据 BASE_URL 填充
	SubscriptionURL string `gorm:"-" json:"subscription_url,omitempty"`

	User           User            `gorm:"foreignKey:UserID" json:"-"`
	CustomConfig   *CustomConfig   `gorm:"foreignKey:CustomConfigID" json:"custom_config,omitempty"`
	ConfigTemplate *ConfigTemplate `gorm:"foreignKey:ConfigTemplateID" json:"config_template,omitempty"`
}
