package migrations

import (
	"clash-config-store/internal/model"

	"gorm.io/gorm"
)

func init() {
	register(Migration{
		Version:     9,
		Description: "create config_histories table",
		Up: func(db *gorm.DB) error {
			return db.AutoMigrate(&model.ConfigHistory{})
		},
	})
}
