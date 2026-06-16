package model

import "time"

// AccessLog 订阅访问日志
type AccessLog struct {
	ID             uint      `gorm:"primarykey" json:"id"`
	SubscriptionID uint      `gorm:"not null;index" json:"subscription_id"`
	IP             string    `json:"ip"`
	Country        string    `json:"country"`
	CountryCode    string    `json:"country_code"`
	City           string    `json:"city"`
	UserAgent      string    `gorm:"type:text" json:"user_agent,omitempty"`
	Allowed        bool      `json:"allowed"`
	DenyReason     string    `json:"deny_reason,omitempty"`
	CreatedAt      time.Time `json:"created_at"`

	Subscription Subscription `gorm:"foreignKey:SubscriptionID" json:"-"`
}
