package migrations

import (
	"clash-config-store/internal/model"

	"gorm.io/gorm"
)

func init() {
	register(Migration{
		Version:     7,
		Description: "add is_admin to users, create system_settings table",
		Up:          migration007Up,
	})
}

func migration007Up(db *gorm.DB) error {
	if err := db.AutoMigrate(&model.User{}, &model.SystemSetting{}); err != nil {
		return err
	}

	// 插入默认设置（幂等）
	return db.Where(model.SystemSetting{Key: "allow_registration"}).
		FirstOrCreate(&model.SystemSetting{Key: "allow_registration", Value: "true"}).Error
}
