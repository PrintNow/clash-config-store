package migrations

import "gorm.io/gorm"

func init() {
	register(Migration{
		Version: 4,
		Up:      upV4EnsureSiteSettingsTable,
	})
}

// upV4EnsureSiteSettingsTable 历史版本：补建 site_settings；逻辑与 EnsureSiteSettingsSchema 一致（幂等）
func upV4EnsureSiteSettingsTable(db *gorm.DB) error {
	return EnsureSiteSettingsSchema(db)
}
