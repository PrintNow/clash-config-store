package migrations

import (
	"clash-config-store/internal/model"

	"gorm.io/gorm"
)

func init() {
	register(Migration{
		Version: 5,
		Up:      upV5UserRoleBackfill,
	})
}

// upV5UserRoleBackfill 修复存量用户 role 为空；若无 root 则将 id 最小用户升为 root（与 v2 逻辑一致，幂等）
func upV5UserRoleBackfill(db *gorm.DB) error {
	if err := db.AutoMigrate(&model.User{}); err != nil {
		return err
	}
	if err := db.Model(&model.User{}).
		Where("role IS NULL OR role = ?", "").
		Update("role", model.RoleUser).Error; err != nil {
		return err
	}
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
	return nil
}
