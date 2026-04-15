package model

// UserAgent 可复用的 User-Agent 字符串
// is_preset=true 为系统内置（user_id 为 NULL，不引用 users），与 RuleProvider 预设一致
type UserAgent struct {
	Base
	UserID   *uint  `gorm:"index" json:"user_id"`  // 自定义条目有值；预设为 nil
	Name     string `gorm:"not null" json:"name"`  // 展示名称
	Value    string `gorm:"not null" json:"value"` // 实际 UA 字符串
	IsPreset bool   `gorm:"default:false" json:"is_preset"`

	User User `gorm:"foreignKey:UserID" json:"-"`
}
