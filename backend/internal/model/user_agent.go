package model

// UserAgent 可复用的 User-Agent 字符串
type UserAgent struct {
	Base
	UserID uint   `gorm:"not null;index" json:"user_id"`
	Name   string `gorm:"not null" json:"name"`  // 展示名称，如 "Mihomo 默认"
	Value  string `gorm:"not null" json:"value"` // 实际 UA 字符串

	User User `gorm:"foreignKey:UserID" json:"-"`
}
