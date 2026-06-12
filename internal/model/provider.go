package model

import "time"

type ProviderType string

const (
	ProviderTypeHTTP   ProviderType = "http"
	ProviderTypeInline ProviderType = "inline"
)

// Provider 上游代理订阅源
type Provider struct {
	Base
	UserID  uint         `gorm:"not null;index" json:"user_id"`
	Name    string       `gorm:"not null" json:"name"`
	Type    ProviderType `gorm:"not null;default:'http'" json:"type"`

	// http 类型字段（type=inline 时忽略）
	URL             string     `gorm:"default:''" json:"url,omitempty"`
	UserAgentID     *uint      `json:"user_agent_id,omitempty"`
	CacheContent    string     `gorm:"type:longtext" json:"-"`
	LastFetchedAt   *time.Time `json:"last_fetched_at,omitempty"`
	CacheTTL        int        `gorm:"default:3600" json:"cache_ttl"`
	FetchError      string     `json:"fetch_error,omitempty"`
	Filter          string     `gorm:"default:''" json:"filter,omitempty"`
	ExcludeFilter   string     `gorm:"default:''" json:"exclude_filter,omitempty"`
	Prefix          string     `gorm:"default:''" json:"prefix,omitempty"`
	Suffix          string     `gorm:"default:''" json:"suffix,omitempty"`
	HealthCheckURL  string     `gorm:"default:''" json:"health_check_url,omitempty"`
	HealthCheckInterval int    `gorm:"default:300" json:"health_check_interval,omitempty"`

	// inline 类型字段
	// 每项是一个节点的 map，序列化为 JSON 存储
	Payload JSONPayload `gorm:"type:longtext;serializer:json" json:"payload,omitempty"`

	User      User       `gorm:"foreignKey:UserID" json:"-"`
	UserAgent *UserAgent `gorm:"foreignKey:UserAgentID" json:"user_agent,omitempty"`
}

// JSONPayload 是 []map[string]interface{} 的类型别名，用于 GORM JSON 序列化
type JSONPayload []map[string]interface{}
