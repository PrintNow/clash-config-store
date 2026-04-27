package model

// 站点配置键
const (
	SettingAllowRegistration = "allow_registration" // 值 "true" / "false"
)

// SiteSetting 站点级 KV 配置（列名避免使用 key：MySQL/MariaDB 保留字）
type SiteSetting struct {
	Key   string `gorm:"primaryKey;column:setting_key" json:"key"`
	Value string `gorm:"not null" json:"value"`
}
