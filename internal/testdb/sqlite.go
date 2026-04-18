package testdb

import (
	"testing"

	"clash-config-store/internal/repository"
	"clash-config-store/internal/repository/migrations"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// UseMemorySQLite 将 repository.DB 切换为内存 SQLite（单测用，勿与 t.Parallel 混用）
func UseMemorySQLite(t *testing.T) {
	t.Helper()
	dsn := "file:" + sanitizeName(t.Name()) + "?mode=memory&cache=shared"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("打开内存 SQLite: %v", err)
	}
	if err := migrations.Ensure(db); err != nil {
		t.Fatalf("迁移: %v", err)
	}
	if err := migrations.Up(db); err != nil {
		t.Fatalf("迁移: %v", err)
	}
	prev := repository.DB
	repository.DB = db
	t.Cleanup(func() {
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
		repository.DB = prev
	})
}

func sanitizeName(name string) string {
	b := make([]byte, 0, len(name))
	for _, r := range name {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9':
			b = append(b, byte(r))
		default:
			b = append(b, '_')
		}
	}
	if len(b) == 0 {
		return "testdb"
	}
	return string(b)
}
