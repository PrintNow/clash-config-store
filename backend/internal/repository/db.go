package repository

import (
	"fmt"
	"log"

	"clash-config-store/internal/config"
	"clash-config-store/internal/model"

	"gorm.io/driver/mysql"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// Init 初始化数据库连接并自动迁移
func Init(cfg *config.Config) error {
	var dialector gorm.Dialector

	switch cfg.DBType {
	case "mysql":
		dialector = mysql.Open(cfg.DBDsn)
	case "sqlite":
		dialector = sqlite.Open(cfg.DBDsn)
	default:
		return fmt.Errorf("不支持的数据库类型: %s，请使用 'mysql' 或 'sqlite'", cfg.DBType)
	}

	var err error
	DB, err = gorm.Open(dialector, &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return fmt.Errorf("数据库连接失败: %w", err)
	}

	if err := MigrateAll(DB); err != nil {
		return fmt.Errorf("数据库迁移失败: %w", err)
	}

	if err := SeedRuleProviders(DB); err != nil {
		log.Printf("[db] 规则集预设种子初始化警告: %v", err)
	}

	log.Printf("[db] 数据库初始化成功 (type=%s)", cfg.DBType)
	return nil
}

// MigrateAll 对所有模型执行 AutoMigrate（生产初始化与单测共用）
func MigrateAll(db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("MigrateAll: db 不能为空")
	}
	return db.AutoMigrate(
		&model.User{},
		&model.UserAgent{},
		&model.Provider{},
		&model.ConfigTemplate{},
		&model.RuleProvider{},
		&model.CustomConfig{},
		&model.Subscription{},
		&model.AccessRestriction{},
		&model.AccessLog{},
	)
}

// SeedRuleProviders 初始化 Loyalsoldier 内置预设规则集（仅首次，幂等）
// 系统预设 is_preset=true 且 user_id=NULL（避免 MySQL 外键引用不存在的 users.id=0）
func SeedRuleProviders(db *gorm.DB) error {
	presets := loyalsoldierPresets()
	for _, p := range presets {
		var existing model.RuleProvider
		err := db.Where("name = ? AND is_preset = ?", p.Name, true).First(&existing).Error
		if err == nil {
			continue // 已存在，跳过
		}
		if err := db.Create(&p).Error; err != nil {
			return fmt.Errorf("创建预设 %s 失败: %w", p.Name, err)
		}
	}
	return nil
}

func loyalsoldierPresets() []*model.RuleProvider {
	cdnBase := "https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/"
	mkRP := func(name, behavior string) *model.RuleProvider {
		return &model.RuleProvider{
			UserID:    nil,
			Name:      name,
			Type:      "http",
			URL:       cdnBase + name + ".txt",
			Behavior:  behavior,
			Format:    "text",
			Interval:  86400,
			IsPreset:  true,
			PresetTag: "loyalsoldier",
		}
	}
	return []*model.RuleProvider{
		mkRP("reject", "domain"),
		mkRP("icloud", "domain"),
		mkRP("apple", "domain"),
		mkRP("google", "domain"),
		mkRP("proxy", "domain"),
		mkRP("direct", "domain"),
		mkRP("private", "domain"),
		mkRP("gfw", "domain"),
		mkRP("tld-not-cn", "domain"),
		mkRP("telegramcidr", "ipcidr"),
		mkRP("cncidr", "ipcidr"),
		mkRP("lancidr", "ipcidr"),
		mkRP("applications", "classical"),
	}
}
