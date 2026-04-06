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

	if err := autoMigrate(); err != nil {
		return fmt.Errorf("数据库迁移失败: %w", err)
	}

	log.Printf("[db] 数据库初始化成功 (type=%s)", cfg.DBType)
	return nil
}

func autoMigrate() error {
	return DB.AutoMigrate(
		&model.User{},
		&model.UserAgent{},
		&model.Provider{},
		&model.CustomConfig{},
		&model.Subscription{},
		&model.AccessRestriction{},
		&model.AccessLog{},
	)
}
