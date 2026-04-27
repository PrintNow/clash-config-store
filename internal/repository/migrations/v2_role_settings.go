package migrations

import (
	"clash-config-store/internal/model"

	"gorm.io/gorm"
)

func init() {
	register(Migration{
		Version: 2,
		Up:      upV2RoleAndSettings,
	})
}

func upV2RoleAndSettings(db *gorm.DB) error {
	if err := db.AutoMigrate(&model.User{}, &model.SiteSetting{}); err != nil {
		return err
	}

	// 补齐新增列后可能出现的空角色（SQLite/MySQL 存量行）
	if err := db.Model(&model.User{}).
		Where("role IS NULL OR role = ?", "").
		Update("role", model.RoleUser).Error; err != nil {
		return err
	}

	// 若无 root，将 id 最小的用户提升为 root（兼容升级前存量数据）
	var rootCount int64
	if err := db.Model(&model.User{}).Where("role = ?", model.RoleRoot).Count(&rootCount).Error; err != nil {
		return err
	}
	if rootCount == 0 {
		var u model.User
		if err := db.Order("id ASC").First(&u).Error; err == nil {
			if err := db.Model(&u).Update("role", model.RoleRoot).Error; err != nil {
				return err
			}
		}
	}

	// 默认关闭开放注册
	var cnt int64
	if err := db.Model(&model.SiteSetting{}).Where(&model.SiteSetting{Key: model.SettingAllowRegistration}).Count(&cnt).Error; err != nil {
		return err
	}
	if cnt == 0 {
		return db.Create(&model.SiteSetting{
			Key:   model.SettingAllowRegistration,
			Value: "false",
		}).Error
	}
	return nil
}
