package model

import "time"

// RuleProvider 规则集库条目，可被多个 CustomConfig 引用
// is_preset=true 为系统内置预设（user_id 为 NULL，不引用 users），不可删除
type RuleProvider struct {
	Base
	// UserID 仅自定义规则集有值；系统预设为 nil，以满足 MySQL 外键（无 id=0 用户）
	UserID *uint  `gorm:"index" json:"user_id"`
	Name   string `gorm:"not null" json:"name"`
	Type     string `gorm:"not null;default:'http'" json:"type"`       // http | file
	URL      string `gorm:"default:''" json:"url"`                     // http 类型远程地址
	Behavior string `gorm:"not null;default:'domain'" json:"behavior"` // domain | ipcidr | classical
	Format   string `gorm:"default:'yaml'" json:"format"`              // yaml | text | mrs
	Interval int    `gorm:"default:86400" json:"interval"`             // 刷新间隔（秒）
	IsPreset bool   `gorm:"default:false" json:"is_preset"`            // 内置预设标记
	PresetTag string `gorm:"default:''" json:"preset_tag"`             // 预设分组标签，如 "loyalsoldier"

	// 规则数（从缓存内容解析）
	RuleCount int `gorm:"default:0" json:"rule_count"`

	// 服务器缓存：将上游内容缓存到本服务，Clash 客户端可直接从本服务拉取
	ServerCacheEnabled bool       `gorm:"default:false" json:"server_cache_enabled"`
	CachedContent      string     `gorm:"type:longtext;default:''" json:"-"`
	CacheExpiresAt     *time.Time `json:"-"`
	CacheToken         string     `gorm:"type:char(64);default:''" json:"-"`

	User User `gorm:"foreignKey:UserID" json:"-"`
}
