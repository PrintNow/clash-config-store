package migrations

import "gorm.io/gorm"

func init() {
	register(Migration{
		Version: 3,
		Up:      dropCustomConfigProxies,
	})
}

func dropCustomConfigProxies(db *gorm.DB) error {
	if db.Migrator().HasColumn("custom_configs", "proxies") {
		return db.Migrator().DropColumn("custom_configs", "proxies")
	}
	return nil
}
