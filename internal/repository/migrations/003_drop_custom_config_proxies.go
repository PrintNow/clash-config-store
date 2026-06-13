package migrations

import "gorm.io/gorm"

func init() {
	register(Migration{
		Version:     3,
		Description: "drop custom_configs.proxies（代理节点改由 inline Provider 承载）",
		Up:          dropCustomConfigProxiesUp,
	})
}

func dropCustomConfigProxiesUp(db *gorm.DB) error {
	return DropColumnIfExists(db, "custom_configs", "proxies")
}
