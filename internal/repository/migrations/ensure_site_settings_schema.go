package migrations

import (
	"errors"
	"strings"

	"clash-config-store/internal/model"

	"gorm.io/gorm"
)

// EnsureSiteSettingsSchema 幂等补全 site_settings：表缺失、遗留列名 key → setting_key、与当前 model 对齐。
//
// 复盘（为何除版本迁移外还要在启动时调用）：
//  1. MySQL/MariaDB 中部分 DDL 会隐式提交，与 GORM 的「整段迁移包在事务里」叠加时，可能出现
//     版本未写入 schema_migrations 但表已创建、或相反等不一致；仅依赖某次 vN 无法覆盖所有现场。
//  2. 手工删表、还原旧备份、或中途换过二进制，也会出现「高版本已标记但表不存在」。
//  3. 因此在 repository.Init 于 migrations.Up 成功之后**再执行一次**本函数，成本低且能自愈上述漂移。
func EnsureSiteSettingsSchema(db *gorm.DB) error {
	if db == nil {
		return errors.New("migrations: EnsureSiteSettingsSchema db 不能为空")
	}

	if !db.Migrator().HasTable("site_settings") {
		if err := db.AutoMigrate(&model.SiteSetting{}); err != nil {
			return err
		}
	}

	switch db.Dialector.Name() {
	case "mysql":
		if mysqlSiteSettingsHasColumn(db, "key") && !mysqlSiteSettingsHasColumn(db, "setting_key") {
			if err := db.Exec("ALTER TABLE site_settings CHANGE COLUMN `key` `setting_key` VARCHAR(191) NOT NULL").Error; err != nil {
				return err
			}
		}
	case "sqlite":
		if sqliteSiteSettingsHasColumn(db, "key") && !sqliteSiteSettingsHasColumn(db, "setting_key") {
			if err := db.Exec("ALTER TABLE site_settings RENAME COLUMN key TO setting_key").Error; err != nil {
				return err
			}
		}
	}

	return db.AutoMigrate(&model.SiteSetting{})
}

func mysqlSiteSettingsHasColumn(db *gorm.DB, columnName string) bool {
	var n int64
	_ = db.Raw(
		`SELECT COUNT(*) FROM information_schema.COLUMNS
		 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'site_settings' AND COLUMN_NAME = ?`,
		columnName,
	).Scan(&n)
	return n > 0
}

func sqliteSiteSettingsHasColumn(db *gorm.DB, columnName string) bool {
	var rows []struct {
		Name string
	}
	if err := db.Raw("PRAGMA table_info(site_settings)").Scan(&rows).Error; err != nil {
		return false
	}
	for _, r := range rows {
		if strings.EqualFold(r.Name, columnName) {
			return true
		}
	}
	return false
}
