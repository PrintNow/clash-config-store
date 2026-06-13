package migrations

import (
	"errors"
	"fmt"
	"log/slog"
	"sort"
	"time"

	"gorm.io/gorm"
)

// SchemaMigration 记录已执行的迁移版本（对应 schema_migrations 表）
type SchemaMigration struct {
	Version     int64     `gorm:"primaryKey;autoIncrement:false"`
	Description string    `gorm:"type:varchar(255);not null;default:''"`
	AppliedAt   time.Time `gorm:"not null"`
}

// Migration 描述一次数据库变更。
//
// 编写规范：
//   - 每次变更新建一个文件，文件名格式：NNN_动词_说明.go（如 004_add_user_settings.go）
//   - Version 从当前最大版本号 +1，保证全局唯一
//   - Up 必须是幂等的（重复执行不报错、不破坏数据）
//   - 新增表/列：db.AutoMigrate(&model.Foo{}) —— GORM 自带幂等
//   - 删除列：DropColumnIfExists(db, "table", "col")
//   - 重命名列：RenameColumnIfExists(db, "table", "old", "new")
//   - 索引变更：CreateIndexIfNotExists / DropIndexIfExists
//   - 数据迁移：db.Exec / db.Model(...).Update(...)
type Migration struct {
	Version     int64
	Description string
	Up          func(db *gorm.DB) error
}

var all []Migration

func register(m Migration) {
	all = append(all, m)
}

// Ensure 确保 schema_migrations 表存在。
func Ensure(db *gorm.DB) error {
	if db == nil {
		return errors.New("migrations: db 不能为空")
	}
	return db.AutoMigrate(&SchemaMigration{})
}

// AppliedVersions 返回已执行的版本集合。
func AppliedVersions(db *gorm.DB) (map[int64]bool, error) {
	var rows []SchemaMigration
	if err := db.Find(&rows).Error; err != nil {
		return nil, err
	}
	m := make(map[int64]bool, len(rows))
	for _, r := range rows {
		m[r.Version] = true
	}
	return m, nil
}

func markApplied(db *gorm.DB, m Migration) error {
	return db.Create(&SchemaMigration{
		Version:     m.Version,
		Description: m.Description,
		AppliedAt:   time.Now(),
	}).Error
}

// Up 按版本顺序执行所有未执行的 Up 迁移，每条在独立事务内运行。
func Up(db *gorm.DB) error {
	if err := Ensure(db); err != nil {
		return err
	}

	applied, err := AppliedVersions(db)
	if err != nil {
		return err
	}

	sort.Slice(all, func(i, j int) bool { return all[i].Version < all[j].Version })

	for _, m := range all {
		if applied[m.Version] {
			continue
		}
		desc := m.Description
		if desc == "" {
			desc = fmt.Sprintf("v%d", m.Version)
		}
		slog.Info("applying migration", slog.String("component", "migrations"), slog.String("desc", desc))

		if m.Up == nil {
			if err := markApplied(db, m); err != nil {
				return err
			}
			continue
		}

		if err := db.Transaction(func(tx *gorm.DB) error {
			if err := m.Up(tx); err != nil {
				return fmt.Errorf("migration %d (%s) failed: %w", m.Version, desc, err)
			}
			return markApplied(tx, m)
		}); err != nil {
			return err
		}

		slog.Info("migration applied", slog.String("component", "migrations"), slog.String("desc", desc))
	}
	return nil
}
