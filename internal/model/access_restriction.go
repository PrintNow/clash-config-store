package model

// RestrictionType 限制类型
type RestrictionType string

const (
	RestrictionTypeIP      RestrictionType = "ip"      // 单个 IP
	RestrictionTypeCIDR    RestrictionType = "cidr"    // CIDR 段
	RestrictionTypeCountry RestrictionType = "country" // 国家代码 ISO 3166-1 alpha-2
)

// RestrictionMode 允许/拒绝
type RestrictionMode string

const (
	RestrictionAllow RestrictionMode = "allow"
	RestrictionDeny  RestrictionMode = "deny"
)

// AccessRestriction 订阅访问限制规则
type AccessRestriction struct {
	Base
	SubscriptionID uint            `gorm:"not null;index" json:"subscription_id"`
	Type           RestrictionType `gorm:"not null" json:"type"`
	Value          string          `gorm:"not null" json:"value"`
	Mode           RestrictionMode `gorm:"not null" json:"mode"`

	Subscription Subscription `gorm:"foreignKey:SubscriptionID" json:"-"`
}
