package model

// RuleProvider 规则集库条目，可被多个 CustomConfig 引用
// is_preset=true 且 user_id=0 为系统内置预设，不可删除
type RuleProvider struct {
	Base
	// UserID=0 表示系统内置预设
	UserID   uint   `gorm:"not null;index" json:"user_id"`
	Name     string `gorm:"not null" json:"name"`
	Type     string `gorm:"not null;default:'http'" json:"type"`      // http | file
	URL      string `gorm:"default:''" json:"url"`                   // http 类型远程地址
	Behavior string `gorm:"not null;default:'domain'" json:"behavior"` // domain | ipcidr | classical
	Format   string `gorm:"default:'yaml'" json:"format"`            // yaml | text | mrs
	Interval int    `gorm:"default:86400" json:"interval"`           // 刷新间隔（秒）
	IsPreset bool   `gorm:"default:false" json:"is_preset"`          // 内置预设标记
	PresetTag string `gorm:"default:''" json:"preset_tag"`           // 预设分组标签，如 "loyalsoldier"

	User User `gorm:"foreignKey:UserID" json:"-"`
}
