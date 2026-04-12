package service

import (
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"

	"clash-config-store/internal/model"
	"clash-config-store/internal/repository"
)

// IsCacheStale 判断 Provider 缓存是否已过期
func IsCacheStale(p *model.Provider) bool {
	if p.LastFetchedAt == nil {
		return true
	}
	ttl := time.Duration(p.CacheTTL) * time.Minute
	return time.Since(*p.LastFetchedAt) > ttl
}

// FetchAndCache 拉取订阅内容并更新数据库中的缓存
func FetchAndCache(providerID uint) error {
	var p model.Provider
	if err := repository.DB.Preload("UserAgent").First(&p, providerID).Error; err != nil {
		return fmt.Errorf("查询 Provider 失败: %w", err)
	}

	// 确定使用的 User-Agent
	ua := "mihomo/1.18.0"
	if p.UserAgent != nil && p.UserAgent.Value != "" {
		ua = p.UserAgent.Value
	}

	slog.Info("拉取订阅", slog.String("component", "fetch"), slog.Uint64("provider_id", uint64(p.ID)),
		slog.String("name", p.Name), slog.String("url", p.URL), slog.String("ua", ua))

	client := &http.Client{Timeout: 30 * time.Second}
	req, err := http.NewRequest(http.MethodGet, p.URL, nil)
	if err != nil {
		errMsg := fmt.Sprintf("构建请求失败: %v", err)
		slog.Warn("拉取订阅失败", slog.String("component", "fetch"), slog.Uint64("provider_id", uint64(p.ID)), slog.String("err", errMsg))
		return saveProviderError(&p, errMsg)
	}
	req.Header.Set("User-Agent", ua)

	resp, err := client.Do(req)
	if err != nil {
		errMsg := fmt.Sprintf("请求失败: %v", err)
		slog.Warn("拉取订阅失败", slog.String("component", "fetch"), slog.Uint64("provider_id", uint64(p.ID)), slog.String("err", errMsg))
		return saveProviderError(&p, errMsg)
	}
	defer resp.Body.Close()

	slog.Info("订阅 HTTP 响应", slog.String("component", "fetch"), slog.Uint64("provider_id", uint64(p.ID)), slog.Int("status", resp.StatusCode))

	if resp.StatusCode != http.StatusOK {
		errMsg := fmt.Sprintf("HTTP 状态码异常: %d", resp.StatusCode)
		slog.Warn("拉取订阅失败", slog.String("component", "fetch"), slog.Uint64("provider_id", uint64(p.ID)), slog.String("err", errMsg))
		return saveProviderError(&p, errMsg)
	}

	// 最大读取 10MB，防止超大响应占用内存
	body, err := io.ReadAll(io.LimitReader(resp.Body, 10*1024*1024))
	if err != nil {
		errMsg := fmt.Sprintf("读取响应体失败: %v", err)
		slog.Warn("拉取订阅失败", slog.String("component", "fetch"), slog.Uint64("provider_id", uint64(p.ID)), slog.String("err", errMsg))
		return saveProviderError(&p, errMsg)
	}

	now := time.Now()
	if err := repository.DB.Model(&p).Updates(map[string]interface{}{
		"cache_content":   string(body),
		"last_fetched_at": now,
		"fetch_error":     "",
	}).Error; err != nil {
		return fmt.Errorf("保存缓存失败: %w", err)
	}

	slog.Info("订阅缓存已更新", slog.String("component", "fetch"), slog.Uint64("provider_id", uint64(p.ID)), slog.Int("bytes", len(body)))
	return nil
}

// AsyncRefresh 在后台 goroutine 中异步刷新 Provider 缓存
func AsyncRefresh(providerID uint) {
	go func() {
		_ = FetchAndCache(providerID)
	}()
}

// saveProviderError 将拉取错误信息持久化到 DB，并返回对应 error
func saveProviderError(p *model.Provider, errMsg string) error {
	repository.DB.Model(p).Update("fetch_error", errMsg)
	return fmt.Errorf("%s", errMsg)
}
