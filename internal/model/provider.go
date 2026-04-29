package model

import "time"

// Provider 上游代理订阅源
type Provider struct {
	Base
	UserID        uint       `gorm:"not null;index" json:"user_id"`
	Name          string     `gorm:"not null" json:"name"`
	URL           string     `gorm:"not null" json:"url"`
	UserAgentID   *uint      `json:"user_agent_id"`          // 为空则用默认 UA
	CacheContent  string     `gorm:"type:longtext" json:"-"` // 缓存的原始响应内容
	LastFetchedAt *time.Time `json:"last_fetched_at"`
	CacheTTL      int        `gorm:"default:60" json:"cache_ttl"` // 缓存有效期（分钟）
	FetchError    string     `json:"fetch_error,omitempty"`       // 最近一次拉取错误信息

	// ── 订阅流量信息（从 subscription-userinfo 响应头解析） ──
	TrafficUpload   *int64     `json:"traffic_upload"`    // 已上传（字节）
	TrafficDownload *int64     `json:"traffic_download"`  // 已下载（字节）
	TrafficTotal    *int64     `json:"traffic_total"`     // 总流量（字节）
	TrafficExpireAt *time.Time `json:"traffic_expire_at"` // 订阅到期时间

	User      User       `gorm:"foreignKey:UserID" json:"-"`
	UserAgent *UserAgent `gorm:"foreignKey:UserAgentID" json:"user_agent,omitempty"`
}
