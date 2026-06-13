package migrations

import (
	"clash-config-store/internal/model"

	"gorm.io/gorm"
)

func init() {
	register(Migration{
		Version:     2,
		Description: "add providers.payload for inline type",
		Up:          migrateProviderInlineUp,
	})
}

func migrateProviderInlineUp(db *gorm.DB) error {
	// 用 AutoMigrate 安全添加列（已存在则跳过）
	return db.AutoMigrate(&model.Provider{})
}
