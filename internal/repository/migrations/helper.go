package migrations

import (
	"fmt"
	"strings"

	"gorm.io/gorm"
)

// ---- 跨数据库 DDL 辅助函数 ----
//
// 使用规范：
//   - 新增表 / 新增列：直接用 db.AutoMigrate(&YourModel{}) —— GORM 自带幂等，无需额外封装
//   - 删除列：DropColumnIfExists(db, "table", "column")
//   - 重命名列：RenameColumnIfExists(db, "table", "old", "new")
//   - 创建索引：CreateIndexIfNotExists(db, "table", "idx_name", "col1", "col2")
//   - 删除索引：DropIndexIfExists(db, "table", "idx_name")
//   - 数据迁移：直接在 Up func 里写 db.Exec(...)

// HasColumn 报告表中是否存在指定列，兼容 SQLite 和 MySQL。
// 不使用 GORM Migrator，避免 SQLite 方言要求 model struct 的问题。
func HasColumn(db *gorm.DB, table, column string) bool {
	switch db.Dialector.Name() {
	case "sqlite":
		var cnt int64
		db.Raw("SELECT COUNT(*) FROM pragma_table_info(?) WHERE name = ?", table, column).Scan(&cnt)
		return cnt > 0
	default: // mysql / postgres
		var cnt int64
		db.Raw(
			"SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
			table, column,
		).Scan(&cnt)
		return cnt > 0
	}
}

// HasTable 报告数据库中是否存在指定表。
func HasTable(db *gorm.DB, table string) bool {
	switch db.Dialector.Name() {
	case "sqlite":
		var cnt int64
		db.Raw("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name = ?", table).Scan(&cnt)
		return cnt > 0
	default:
		var cnt int64
		db.Raw("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?", table).Scan(&cnt)
		return cnt > 0
	}
}

// HasIndex 报告表上是否存在指定索引。
func HasIndex(db *gorm.DB, table, index string) bool {
	switch db.Dialector.Name() {
	case "sqlite":
		var cnt int64
		db.Raw("SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND tbl_name = ? AND name = ?", table, index).Scan(&cnt)
		return cnt > 0
	default:
		var cnt int64
		db.Raw(
			"SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",
			table, index,
		).Scan(&cnt)
		return cnt > 0
	}
}

// DropColumnIfExists 幂等删除列，兼容 SQLite（3.35+）和 MySQL。
//
// SQLite 不支持通过 GORM Migrator.DropColumn(string) 调用，
// 必须走原生 ALTER TABLE ... DROP COLUMN。
func DropColumnIfExists(db *gorm.DB, table, column string) error {
	if !HasColumn(db, table, column) {
		return nil
	}
	return db.Exec(fmt.Sprintf("ALTER TABLE `%s` DROP COLUMN `%s`", table, column)).Error
}

// RenameColumnIfExists 幂等重命名列。
// 目标列已存在（即已重命名）时直接跳过，避免重复执行报错。
func RenameColumnIfExists(db *gorm.DB, table, oldColumn, newColumn string) error {
	if !HasColumn(db, table, oldColumn) {
		return nil // 已重命名或根本不存在
	}
	if HasColumn(db, table, newColumn) {
		return nil // 目标列已存在，视为已完成
	}
	return db.Exec(
		fmt.Sprintf("ALTER TABLE `%s` RENAME COLUMN `%s` TO `%s`", table, oldColumn, newColumn),
	).Error
}

// CreateIndexIfNotExists 幂等创建索引。columns 为参与索引的列名（顺序敏感）。
func CreateIndexIfNotExists(db *gorm.DB, table, indexName string, columns ...string) error {
	if HasIndex(db, table, indexName) {
		return nil
	}
	cols := quotedColumns(columns)
	return db.Exec(
		fmt.Sprintf("CREATE INDEX `%s` ON `%s` (%s)", indexName, table, cols),
	).Error
}

// CreateUniqueIndexIfNotExists 幂等创建唯一索引。
func CreateUniqueIndexIfNotExists(db *gorm.DB, table, indexName string, columns ...string) error {
	if HasIndex(db, table, indexName) {
		return nil
	}
	cols := quotedColumns(columns)
	return db.Exec(
		fmt.Sprintf("CREATE UNIQUE INDEX `%s` ON `%s` (%s)", indexName, table, cols),
	).Error
}

func quotedColumns(columns []string) string {
	quoted := make([]string, len(columns))
	for i, c := range columns {
		quoted[i] = "`" + c + "`"
	}
	return strings.Join(quoted, ", ")
}

// DropIndexIfExists 幂等删除索引，兼容 SQLite 和 MySQL。
func DropIndexIfExists(db *gorm.DB, table, indexName string) error {
	if !HasIndex(db, table, indexName) {
		return nil
	}
	switch db.Dialector.Name() {
	case "sqlite":
		return db.Exec(fmt.Sprintf("DROP INDEX IF EXISTS `%s`", indexName)).Error
	default:
		return db.Exec(fmt.Sprintf("DROP INDEX `%s` ON `%s`", indexName, table)).Error
	}
}
