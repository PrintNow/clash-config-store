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
	EnabledProviderIDs string         `gorm:"type:text" json:"enabled_provider_ids"` // JSON 编码的 []uint
	CustomConfigID     *uint          `json:"custom_config_id"`
	RuleInsertMode     RuleInsertMode `gorm:"default:'prepend'" json:"rule_insert_mode"`
	ProxyPrefixEnabled bool           `gorm:"default:true" json:"proxy_prefix_enabled"`
	// BaseConfig 存储额外的 mihomo 顶层字段（JSON），如 mixed-port、dns、tun 等
	BaseConfig string `gorm:"type:text" json:"base_config"`

	User         User          `gorm:"foreignKey:UserID" json:"-"`
	CustomConfig *CustomConfig `gorm:"foreignKey:CustomConfigID" json:"custom_config,omitempty"`
}
