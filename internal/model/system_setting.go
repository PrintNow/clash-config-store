package model

// SystemSetting 系统设置 key-value 表
type SystemSetting struct {
	Key   string `gorm:"primaryKey;type:varchar(255)" json:"key"`
	Value string `gorm:"not null;default:''" json:"value"`
}
