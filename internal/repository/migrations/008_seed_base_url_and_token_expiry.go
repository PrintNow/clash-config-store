package migrations

import (
	"clash-config-store/internal/model"

	"gorm.io/gorm"
)

func init() {
	register(Migration{
		Version:     8,
		Description: "seed base_url and default_token_expiry_days settings",
		Up:          migration008Up,
	})
}

func migration008Up(db *gorm.DB) error {
	defaults := []model.SystemSetting{
		{Key: "base_url", Value: ""},
		{Key: "default_token_expiry_days", Value: "0"},
	}
	for _, s := range defaults {
		if err := db.Where(model.SystemSetting{Key: s.Key}).
			FirstOrCreate(&s).Error; err != nil {
			return err
		}
	}
	return nil
}
