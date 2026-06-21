package model

import "time"

// ConfigHistory 自定义配置的变更历史快照
type ConfigHistory struct {
	ID             uint                     `gorm:"primarykey" json:"id"`
	CustomConfigID uint                     `gorm:"not null;index" json:"custom_config_id"`
	UserID         uint                     `gorm:"not null;index" json:"user_id"`
	Name           string                   `json:"name"`
	ProxyGroups    []map[string]interface{} `gorm:"serializer:json;type:longtext" json:"proxy_groups"`
	Rules          []string                 `gorm:"serializer:json;type:longtext" json:"rules"`
	RuleProviderIDs  []uint                 `gorm:"serializer:json;type:longtext" json:"rule_provider_ids"`
	HostedRuleSetIDs []uint                 `gorm:"serializer:json;type:longtext" json:"hosted_rule_set_ids"`
	CreatedAt      time.Time                `json:"created_at"`
}
