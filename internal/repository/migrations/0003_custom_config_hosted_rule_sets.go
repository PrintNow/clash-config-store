package migrations

import (
	"clash-config-store/internal/model"

	"gorm.io/gorm"
)

func init() {
	register(Migration{
		Version: 3,
		Up:      up0003CustomConfigHostedRuleSets,
	})
}

func up0003CustomConfigHostedRuleSets(db *gorm.DB) error {
	return db.AutoMigrate(&model.RuleProvider{}, &model.HostedRuleSet{}, &model.CustomConfig{})
}
