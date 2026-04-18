package repository

import (
	"testing"

	"clash-config-store/internal/model"
	"clash-config-store/internal/repository/migrations"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestMigrateAll_nilDB(t *testing.T) {
	t.Parallel()
	if err := MigrateAll(nil); err == nil {
		t.Fatal("nil DB 应返回错误")
	}
}

func TestMigrateAll_memorySQLite(t *testing.T) {
	t.Parallel()
	db, err := gorm.Open(sqlite.Open("file:migrate_test?mode=memory"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := MigrateAll(db); err != nil {
		t.Fatal(err)
	}
	sqlDB, _ := db.DB()
	_ = sqlDB.Close()
}

func TestMigrationsUp_memorySQLite(t *testing.T) {
	t.Parallel()
	db, err := gorm.Open(sqlite.Open("file:migrate_up_test?mode=memory"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := migrations.Ensure(db); err != nil {
		t.Fatal(err)
	}
	if err := migrations.Up(db); err != nil {
		t.Fatal(err)
	}
	if !db.Migrator().HasTable(&model.HostedRuleSet{}) {
		t.Fatal("hosted_rule_sets 表应存在")
	}
	sqlDB, _ := db.DB()
	_ = sqlDB.Close()
}
