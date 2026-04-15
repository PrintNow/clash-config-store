package handler

import (
	"testing"

	"clash-config-store/internal/model"
	"clash-config-store/internal/repository"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// 复现列表聚合访问次数：须与 GetAccessLogs 的 Model 计数一致
func TestListSubscriptions_accessLogCountAggregate(t *testing.T) {
	db, err := gorm.Open(sqlite.Open("file:sub_count_test?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.Subscription{}, &model.AccessLog{}); err != nil {
		t.Fatal(err)
	}
	prev := repository.DB
	repository.DB = db
	t.Cleanup(func() { repository.DB = prev })

	u := model.User{Email: "a@b.c", Name: "t", PasswordHash: "x"}
	if err := db.Create(&u).Error; err != nil {
		t.Fatal(err)
	}
	sub := model.Subscription{UserID: u.ID, Name: "s", Token: "tok1", EnabledProviderIDs: "[]"}
	if err := db.Create(&sub).Error; err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 3; i++ {
		if err := db.Create(&model.AccessLog{SubscriptionID: sub.ID, IP: "1.1.1.1", Allowed: true}).Error; err != nil {
			t.Fatal(err)
		}
	}

	ids := []uint{sub.ID}
	type cntRow struct {
		SubscriptionID uint  `gorm:"column:subscription_id"`
		Cnt            int64 `gorm:"column:cnt"`
	}
	var rows []cntRow
	if err := db.Model(&model.AccessLog{}).
		Select("subscription_id, COUNT(*) AS cnt").
		Where("subscription_id IN ?", ids).
		Group("subscription_id").
		Scan(&rows).Error; err != nil {
		t.Fatal(err)
	}
	if len(rows) != 1 || rows[0].Cnt != 3 {
		t.Fatalf("Model+Scan 聚合异常: rows=%v", rows)
	}

	var rows2 []cntRow
	if err := db.Table("access_logs").
		Select("subscription_id, COUNT(*) AS cnt").
		Where("subscription_id IN ?", ids).
		Group("subscription_id").
		Scan(&rows2).Error; err != nil {
		t.Fatal(err)
	}
	if len(rows2) != 1 || rows2[0].Cnt != 3 {
		t.Fatalf("Table+Scan 聚合异常: rows=%v", rows2)
	}

	var total int64
	db.Model(&model.AccessLog{}).Where("subscription_id = ?", sub.ID).Count(&total)
	if total != 3 {
		t.Fatalf("Count 与聚合不一致: total=%d", total)
	}
}
