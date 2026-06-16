package migrations

import (
	"clash-config-store/internal/model"
	"clash-config-store/internal/util"

	"gorm.io/gorm"
)

func init() {
	register(Migration{
		Version:     6,
		Description: "enable server cache for all preset rule providers",
		Up:          migrate006Up,
	})
}

func migrate006Up(db *gorm.DB) error {
	var presets []model.RuleProvider
	if err := db.Where("is_preset = ?", true).Find(&presets).Error; err != nil {
		return err
	}
	for _, rp := range presets {
		updates := map[string]interface{}{
			"server_cache_enabled": true,
		}
		if rp.CacheToken == "" {
			token, err := util.GenerateSubscriptionToken()
			if err != nil {
				return err
			}
			updates["cache_token"] = token
		}
		if err := db.Model(&rp).Updates(updates).Error; err != nil {
			return err
		}
	}
	return nil
}
