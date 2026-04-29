package migrations

import "gorm.io/gorm"

func init() {
	register(Migration{
		Version: 3,
		Up:      upV3SiteSettingRenameKeyColumn,
	})
}

// upV3SiteSettingRenameKeyColumn 历史版本：列名 key → setting_key；逻辑已收敛至 EnsureSiteSettingsSchema
func upV3SiteSettingRenameKeyColumn(db *gorm.DB) error {
	return EnsureSiteSettingsSchema(db)
}
