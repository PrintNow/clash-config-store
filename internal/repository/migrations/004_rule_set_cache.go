package migrations

import (
	"clash-config-store/internal/model"

	"gorm.io/gorm"
)

func init() {
	register(Migration{
		Version:     4,
		Description: "add rule_count to hosted_rule_sets; add server cache fields to rule_providers",
		Up:          migrate004Up,
	})
}

func migrate004Up(db *gorm.DB) error {
	if err := db.AutoMigrate(&model.RuleProvider{}); err != nil {
		return err
	}
	return db.AutoMigrate(&model.HostedRuleSet{})
}
