package migrations

import (
	"errors"

	"clash-config-store/internal/model"

	"gorm.io/gorm"
)

func init() {
	register(Migration{
		Version: 1,
		Up:      applySchemaUp,
	})
}

func applySchemaUp(db *gorm.DB) error {
	return ApplySchema(db)
}

// ApplySchema 与业务模型一致的完整表结构（初始迁移与工具函数共用）。
// 后续变更：新增更高 Version 的 register + Up，或在本函数中扩展并配合新版本号；勿使用「-:migration 排除列 + 默认 Create 写同名列」这类易漂移组合。
func ApplySchema(db *gorm.DB) error {
	if db == nil {
		return errors.New("migrations: ApplySchema db 不能为空")
	}
	return db.AutoMigrate(
		&model.User{},
		&model.UserAgent{},
		&model.Provider{},
		&model.ConfigTemplate{},
		&model.RuleProvider{},
		&model.HostedRuleSet{},
		&model.CustomConfig{},
		&model.Subscription{},
		&model.AccessRestriction{},
		&model.AccessLog{},
	)
}
