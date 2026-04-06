package model

// CustomConfig 用户自定义规则集（proxies / proxy-groups / rules）
type CustomConfig struct {
	Base
	UserID uint   `gorm:"not null;index" json:"user_id"`
	Name   string `gorm:"not null" json:"name"`
	// 以下字段均以 YAML 文本存储，内容为对应 mihomo 字段的 YAML 片段
	Proxies     string `gorm:"type:text" json:"proxies"`      // proxies 数组的 YAML 文本
	ProxyGroups string `gorm:"type:text" json:"proxy_groups"` // proxy-groups 数组的 YAML 文本
	Rules       string `gorm:"type:text" json:"rules"`        // rules 数组的 YAML 文本

	User User `gorm:"foreignKey:UserID" json:"-"`
}
