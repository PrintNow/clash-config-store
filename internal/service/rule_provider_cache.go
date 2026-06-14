package service

import (
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"

	"clash-config-store/internal/model"
	"clash-config-store/internal/repository"
	"clash-config-store/internal/util"
)

// IsRuleProviderCacheStale 判断外部规则集的服务器缓存是否已过期
func IsRuleProviderCacheStale(rp *model.RuleProvider) bool {
	return rp.CacheExpiresAt == nil || time.Now().After(*rp.CacheExpiresAt)
}

// FetchAndCacheRuleProvider 从上游拉取外部规则集内容并更新服务器缓存
func FetchAndCacheRuleProvider(ruleProviderID uint) error {
	var rp model.RuleProvider
	if err := repository.DB.First(&rp, ruleProviderID).Error; err != nil {
		return fmt.Errorf("查询规则集失败: %w", err)
	}

	if !rp.ServerCacheEnabled || rp.URL == "" {
		return nil
	}

	slog.Info("拉取规则集缓存", slog.String("component", "rule-cache"),
		slog.Uint64("id", uint64(rp.ID)), slog.String("name", rp.Name), slog.String("url", rp.URL))

	client := &http.Client{Timeout: 30 * time.Second}
	req, err := http.NewRequest(http.MethodGet, rp.URL, nil)
	if err != nil {
		return saveRuleProviderCacheError(&rp, fmt.Sprintf("构建请求失败: %v", err))
	}
	req.Header.Set("User-Agent", "mihomo/1.18.0")

	resp, err := client.Do(req)
	if err != nil {
		return saveRuleProviderCacheError(&rp, fmt.Sprintf("请求失败: %v", err))
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return saveRuleProviderCacheError(&rp, fmt.Sprintf("HTTP 状态码异常: %d", resp.StatusCode))
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 10*1024*1024))
	if err != nil {
		return saveRuleProviderCacheError(&rp, fmt.Sprintf("读取响应体失败: %v", err))
	}

	content := string(body)
	ruleCount := util.CountRules(content, rp.Format)
	expiresAt := time.Now().Add(time.Duration(rp.Interval) * time.Second)

	if err := repository.DB.Model(&rp).Updates(map[string]interface{}{
		"cached_content":   content,
		"cache_expires_at": expiresAt,
		"rule_count":       ruleCount,
	}).Error; err != nil {
		return fmt.Errorf("保存缓存失败: %w", err)
	}

	slog.Info("规则集缓存已更新", slog.String("component", "rule-cache"),
		slog.Uint64("id", uint64(rp.ID)), slog.Int("rules", ruleCount), slog.Int("bytes", len(body)))
	return nil
}

// AsyncFetchAndCacheRuleProvider 在后台异步刷新外部规则集缓存
func AsyncFetchAndCacheRuleProvider(id uint) {
	go func() {
		_ = FetchAndCacheRuleProvider(id)
	}()
}

func saveRuleProviderCacheError(rp *model.RuleProvider, errMsg string) error {
	slog.Warn("拉取规则集缓存失败", slog.String("component", "rule-cache"),
		slog.Uint64("id", uint64(rp.ID)), slog.String("err", errMsg))
	return fmt.Errorf("%s", errMsg)
}
