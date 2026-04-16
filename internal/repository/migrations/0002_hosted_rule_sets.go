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
	if err := db.AutoMigrate(&model.HostedRuleSet{}); err != nil {
		return err
	}
	if !db.Migrator().HasColumn(&model.RuleProvider{}, "hosted_rule_set_id") {
		if err := db.Migrator().AddColumn(&model.RuleProvider{}, "HostedRuleSetID"); err != nil {
			return err
		}
	}
	return nil
}

