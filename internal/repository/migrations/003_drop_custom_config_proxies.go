package migrations

import "gorm.io/gorm"

func init() {
	register(Migration{
		Version: 3,
		Up:      dropCustomConfigProxies,
	})
}

func dropCustomConfigProxies(db *gorm.DB) error {
	// 用 pragma_table_info 检查列是否存在（避免传字符串给 DropColumn 导致 nil schema panic）
	var count int64
	db.Raw("SELECT COUNT(*) FROM pragma_table_info('custom_configs') WHERE name = 'proxies'").Scan(&count)
	if count == 0 {
		return nil
	}
	return db.Exec("ALTER TABLE custom_configs DROP COLUMN proxies").Error
}
