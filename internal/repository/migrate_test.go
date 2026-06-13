package repository

import (
	"testing"

	"clash-config-store/internal/model"
	"clash-config-store/internal/repository/migrations"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func newTestDB(t *testing.T, name string) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(
		sqlite.Open("file:"+name+"?mode=memory&cache=shared"),
		&gorm.Config{Logger: logger.Default.LogMode(logger.Silent)},
	)
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	t.Cleanup(func() {
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
	})
	return db
}

func TestMigrateAll_nilDB(t *testing.T) {
	t.Parallel()
	if err := MigrateAll(nil); err == nil {
		t.Fatal("nil DB 应返回错误")
	}
}

func TestMigrateAll_memorySQLite(t *testing.T) {
	t.Parallel()
	db := newTestDB(t, "migrate_all_test")
	if err := MigrateAll(db); err != nil {
		t.Fatal(err)
	}
}

func TestMigrationsUp_memorySQLite(t *testing.T) {
	t.Parallel()
	db := newTestDB(t, "migrate_up_test")

	if err := migrations.Ensure(db); err != nil {
		t.Fatal(err)
	}
	if err := migrations.Up(db); err != nil {
		t.Fatal(err)
	}
	// 关键表应存在
	for _, model := range []any{
		&model.HostedRuleSet{},
		&model.Provider{},
		&model.CustomConfig{},
	} {
		if !db.Migrator().HasTable(model) {
			t.Fatalf("表不存在: %T", model)
		}
	}
}

func TestMigrationsUp_idempotent(t *testing.T) {
	t.Parallel()
	db := newTestDB(t, "migrate_idempotent_test")

	// 执行两次，应均成功
	for i := range 2 {
		if err := migrations.Up(db); err != nil {
			t.Fatalf("第 %d 次 Up 失败: %v", i+1, err)
		}
	}
}

// TestMigrationHelpers_SQLite 验证 helper 函数在 SQLite 上的跨 DB 兼容性
func TestMigrationHelpers_SQLite(t *testing.T) {
	t.Parallel()
	db := newTestDB(t, "helper_test")

	// 建一张测试表
	if err := db.Exec(`CREATE TABLE IF NOT EXISTS _test_tbl (
		id   INTEGER PRIMARY KEY,
		foo  TEXT,
		bar  INTEGER
	)`).Error; err != nil {
		t.Fatal(err)
	}

	t.Run("HasTable", func(t *testing.T) {
		if !migrations.HasTable(db, "_test_tbl") {
			t.Fatal("应报告表存在")
		}
		if migrations.HasTable(db, "_no_such_table") {
			t.Fatal("应报告表不存在")
		}
	})

	t.Run("HasColumn", func(t *testing.T) {
		if !migrations.HasColumn(db, "_test_tbl", "foo") {
			t.Fatal("应报告列存在")
		}
		if migrations.HasColumn(db, "_test_tbl", "ghost") {
			t.Fatal("应报告列不存在")
		}
	})

	t.Run("DropColumnIfExists_existing", func(t *testing.T) {
		if err := migrations.DropColumnIfExists(db, "_test_tbl", "bar"); err != nil {
			t.Fatalf("删除存在的列失败: %v", err)
		}
		if migrations.HasColumn(db, "_test_tbl", "bar") {
			t.Fatal("列应已被删除")
		}
	})

	t.Run("DropColumnIfExists_missing", func(t *testing.T) {
		// 列不存在，应幂等返回 nil
		if err := migrations.DropColumnIfExists(db, "_test_tbl", "ghost"); err != nil {
			t.Fatalf("删除不存在的列应静默成功: %v", err)
		}
	})

	t.Run("RenameColumnIfExists", func(t *testing.T) {
		if err := migrations.RenameColumnIfExists(db, "_test_tbl", "foo", "foo2"); err != nil {
			t.Fatalf("重命名列失败: %v", err)
		}
		if !migrations.HasColumn(db, "_test_tbl", "foo2") {
			t.Fatal("重命名后 foo2 应存在")
		}
		if migrations.HasColumn(db, "_test_tbl", "foo") {
			t.Fatal("重命名后 foo 应不存在")
		}
		// 幂等：再次执行应无错
		if err := migrations.RenameColumnIfExists(db, "_test_tbl", "foo", "foo2"); err != nil {
			t.Fatalf("幂等重命名应无错: %v", err)
		}
	})

	t.Run("CreateIndexIfNotExists", func(t *testing.T) {
		if err := migrations.CreateIndexIfNotExists(db, "_test_tbl", "idx_test_tbl_foo2", "foo2"); err != nil {
			t.Fatalf("创建索引失败: %v", err)
		}
		if !migrations.HasIndex(db, "_test_tbl", "idx_test_tbl_foo2") {
			t.Fatal("索引应已创建")
		}
		// 幂等
		if err := migrations.CreateIndexIfNotExists(db, "_test_tbl", "idx_test_tbl_foo2", "foo2"); err != nil {
			t.Fatalf("幂等创建索引应无错: %v", err)
		}
	})

	t.Run("DropIndexIfExists", func(t *testing.T) {
		if err := migrations.DropIndexIfExists(db, "_test_tbl", "idx_test_tbl_foo2"); err != nil {
			t.Fatalf("删除索引失败: %v", err)
		}
		if migrations.HasIndex(db, "_test_tbl", "idx_test_tbl_foo2") {
			t.Fatal("索引应已删除")
		}
		// 幂等
		if err := migrations.DropIndexIfExists(db, "_test_tbl", "idx_test_tbl_foo2"); err != nil {
			t.Fatalf("幂等删除索引应无错: %v", err)
		}
	})
}
