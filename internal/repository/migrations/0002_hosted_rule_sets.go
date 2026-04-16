package migrations

import (
	"clash-config-store/internal/model"

	"gorm.io/gorm"
)

func init() {
	register(Migration{
		Version: 2,
		Up:      up0002HostedRuleSets,
	})
}

func up0002HostedRuleSets(db *gorm.DB) error {
	return db.AutoMigrate(&model.HostedRuleSet{})
}
