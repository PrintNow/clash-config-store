package migrations

import (
	"errors"
	"sort"
	"time"

	"gorm.io/gorm"
)

type SchemaMigration struct {
	Version   int64     `gorm:"primaryKey;autoIncrement:false"`
	AppliedAt time.Time `gorm:"not null"`
}

type Migration struct {
	Version int64
	Up      func(db *gorm.DB) error
}

var all []Migration

func register(m Migration) {
	all = append(all, m)
}

func Ensure(db *gorm.DB) error {
	if db == nil {
		return errors.New("migrations: db 不能为空")
	}
	return db.AutoMigrate(&SchemaMigration{})
}

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

func MarkApplied(db *gorm.DB, version int64) error {
	return db.Create(&SchemaMigration{Version: version, AppliedAt: time.Now()}).Error
}

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
		if m.Up == nil {
			if err := MarkApplied(db, m.Version); err != nil {
				return err
			}
			continue
		}
		if err := db.Transaction(func(tx *gorm.DB) error {
			if err := m.Up(tx); err != nil {
				return err
			}
			return MarkApplied(tx, m.Version)
		}); err != nil {
			return err
		}
	}
	return nil
}

