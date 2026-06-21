package repository

import (
	"fmt"
	"log/slog"

	"clash-config-store/internal/applog"
	"clash-config-store/internal/config"
	"clash-config-store/internal/model"
	"clash-config-store/internal/repository/migrations"
	"clash-config-store/internal/util"

	"github.com/glebarez/sqlite"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

// GetSetting 读取系统设置，不存在时返回 defaultVal
func GetSetting(key, defaultVal string) string {
	var s model.SystemSetting
	if err := DB.Where("key = ?", key).First(&s).Error; err != nil {
		return defaultVal
	}
	return s.Value
}

// SetSetting 写入系统设置（upsert）
func SetSetting(key, value string) error {
	return DB.Model(&model.SystemSetting{}).Where("key = ?", key).Update("value", value).Error
}

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
		Logger: applog.GormLogger(),
	})
	if err != nil {
		return fmt.Errorf("数据库连接失败: %w", err)
	}

	if err := migrations.Ensure(DB); err != nil {
		return fmt.Errorf("数据库迁移失败: %w", err)
	}
	if err := migrations.Up(DB); err != nil {
		return fmt.Errorf("数据库迁移失败: %w", err)
	}

	if err := SeedRuleProviders(DB); err != nil {
		slog.Warn("规则集预设种子初始化警告", slog.String("component", "db"), slog.Any("err", err))
	}

	if err := SeedUserAgentPresets(DB); err != nil {
		slog.Warn("UA 内置预设种子初始化警告", slog.String("component", "db"), slog.Any("err", err))
	}

	// 用数据库中的 base_url 覆盖启动时的环境变量配置（若已设置）
	if v := GetSetting("base_url", ""); v != "" {
		config.App.BaseURL = v
		slog.Info("base_url 已从数据库覆盖", slog.String("component", "db"), slog.String("base_url", v))
	}

	slog.Info("数据库初始化成功", slog.String("component", "db"), slog.String("db_type", cfg.DBType))
	return nil
}

// MigrateAll 与 migrations.ApplySchema 等价（单测等场景）
func MigrateAll(db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("MigrateAll: db 不能为空")
	}
	return migrations.ApplySchema(db)
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
		token, _ := util.GenerateSubscriptionToken()
		return &model.RuleProvider{
			UserID:             nil,
			Name:               name,
			Type:               "http",
			URL:                cdnBase + name + ".txt",
			Behavior:           behavior,
			Format:             "text",
			Interval:           86400,
			IsPreset:           true,
			PresetTag:          "loyalsoldier",
			ServerCacheEnabled: true,
			CacheToken:         token,
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

// SeedUserAgentPresets 写入常用客户端 UA 预设（幂等）
func SeedUserAgentPresets(db *gorm.DB) error {
	for _, p := range defaultUserAgentPresets() {
		var existing model.UserAgent
		err := db.Where("name = ? AND is_preset = ?", p.Name, true).First(&existing).Error
		if err == nil {
			continue
		}
		if err := db.Create(&p).Error; err != nil {
			return fmt.Errorf("创建 UA 预设 %s 失败: %w", p.Name, err)
		}
	}
	return nil
}

func defaultUserAgentPresets() []*model.UserAgent {
	return []*model.UserAgent{
		{UserID: nil, Name: "Mihomo", Value: "Mihomo/1.18.0", IsPreset: true},
		{UserID: nil, Name: "ClashX", Value: "ClashX/1.96.2.4", IsPreset: true},
		{UserID: nil, Name: "Clash", Value: "Clash/0.20.0", IsPreset: true},
	}
}
