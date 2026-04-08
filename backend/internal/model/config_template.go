package model

// ConfigTemplate 可复用的顶层 mihomo 配置模板（mixed-port、dns、tun 等）
// 多个 Subscription 可引用同一模板，Content 以 YAML 文本存储
type ConfigTemplate struct {
	Base
	UserID      uint   `gorm:"not null;index" json:"user_id"`
	Name        string `gorm:"not null" json:"name"`
	Description string `gorm:"default:''" json:"description"`
	// Content 存储完整的顶层 YAML 配置片段（除 proxies/proxy-groups/rules 之外的部分）
	Content string `gorm:"type:text" json:"content"`

	User User `gorm:"foreignKey:UserID" json:"-"`
}
