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

func init() {
	register(Migration{
		Version: 20260429133900,
		Up:      migrate20260429133900,
	})
}

// migrate20260429133900 为 Provider 表新增流量信息字段（subscription-userinfo 解析结果）。
func migrate20260429133900(db *gorm.DB) error {
	return db.Exec(`
		ALTER TABLE providers
		ADD COLUMN traffic_upload    BIGINT       NULL AFTER fetch_error,
		ADD COLUMN traffic_download  BIGINT       NULL AFTER traffic_upload,
		ADD COLUMN traffic_total     BIGINT       NULL AFTER traffic_download,
		ADD COLUMN traffic_expire_at DATETIME(3)  NULL AFTER traffic_total
	`).Error
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
