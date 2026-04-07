package service

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"clash-config-store/internal/model"
	"clash-config-store/internal/repository"
	"clash-config-store/internal/testdb"

	"golang.org/x/crypto/bcrypt"
)

func TestIsCacheStale(t *testing.T) {
	t.Parallel()
	now := time.Now()
	past := now.Add(-2 * time.Hour)
	recent := now.Add(-30 * time.Second)

	if !IsCacheStale(&model.Provider{LastFetchedAt: nil}) {
		t.Fatal("无拉取时间应视为过期")
	}
	if !IsCacheStale(&model.Provider{LastFetchedAt: &past, CacheTTL: 60}) {
		t.Fatal("超过 TTL 应过期")
	}
	if IsCacheStale(&model.Provider{LastFetchedAt: &recent, CacheTTL: 60}) {
		t.Fatal("未超 TTL 不应过期")
	}
}

func TestFetchAndCache_OK(t *testing.T) {
	testdb.UseMemorySQLite(t)

	hash, _ := bcrypt.GenerateFromPassword([]byte("x"), bcrypt.MinCost)
	user := model.User{Email: "u@test.local", Name: "u", PasswordHash: string(hash)}
	if err := repository.DB.Create(&user).Error; err != nil {
		t.Fatal(err)
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("proxies:\n  - name: n\n    type: ss\n"))
	}))
	t.Cleanup(srv.Close)

	p := model.Provider{UserID: user.ID, Name: "p1", URL: srv.URL, CacheTTL: 60}
	if err := repository.DB.Create(&p).Error; err != nil {
		t.Fatal(err)
	}

	if err := FetchAndCache(p.ID); err != nil {
		t.Fatalf("FetchAndCache: %v", err)
	}

	var got model.Provider
	if err := repository.DB.First(&got, p.ID).Error; err != nil {
		t.Fatal(err)
	}
	if got.FetchError != "" {
		t.Fatalf("不应有 fetch_error: %q", got.FetchError)
	}
	if got.CacheContent == "" {
		t.Fatal("应写入 cache_content")
	}
	if got.LastFetchedAt == nil {
		t.Fatal("应写入 last_fetched_at")
	}
}

func TestFetchAndCache_Non200WritesFetchError(t *testing.T) {
	testdb.UseMemorySQLite(t)

	hash, _ := bcrypt.GenerateFromPassword([]byte("x"), bcrypt.MinCost)
	user := model.User{Email: "u2@test.local", Name: "u", PasswordHash: string(hash)}
	if err := repository.DB.Create(&user).Error; err != nil {
		t.Fatal(err)
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusPaymentRequired)
	}))
	t.Cleanup(srv.Close)

	p := model.Provider{UserID: user.ID, Name: "p2", URL: srv.URL, CacheTTL: 60}
	if err := repository.DB.Create(&p).Error; err != nil {
		t.Fatal(err)
	}

	err := FetchAndCache(p.ID)
	if err == nil {
		t.Fatal("非 200 应返回错误")
	}

	var got model.Provider
	if err := repository.DB.First(&got, p.ID).Error; err != nil {
		t.Fatal(err)
	}
	if got.FetchError == "" {
		t.Fatal("应将错误写入 fetch_error")
	}
}
