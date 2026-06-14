package migrations

import "gorm.io/gorm"

func init() {
	register(Migration{
		Version:     5,
		Description: "drop subscriptions.enabled_provider_ids（Provider 由 CustomConfig use: 字段自动推导）",
		Up:          dropEnabledProviderIDsUp,
	})
}

func dropEnabledProviderIDsUp(db *gorm.DB) error {
	return DropColumnIfExists(db, "subscriptions", "enabled_provider_ids")
}
