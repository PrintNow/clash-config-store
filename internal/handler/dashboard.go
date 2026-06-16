package handler

import (
	"time"

	"clash-config-store/internal/middleware"
	"clash-config-store/internal/model"
	"clash-config-store/internal/repository"
	"clash-config-store/internal/service"

	"github.com/gin-gonic/gin"
)

// ProviderStatus Provider 缓存状态摘要
type ProviderStatus struct {
	ID            uint               `json:"id"`
	Name          string             `json:"name"`
	Type          model.ProviderType `json:"type"`
	URL           string             `json:"url"`
	UpdatedAt     time.Time          `json:"updated_at"`
	LastFetchedAt *time.Time         `json:"last_fetched_at"`
	FetchError    string             `json:"fetch_error"`
	CacheStale    bool               `json:"cache_stale"`
}

// SubscriptionHealth 订阅健康摘要
type SubscriptionHealth struct {
	ID                uint       `json:"id"`
	Name              string     `json:"name"`
	SubscriptionURL   string     `json:"subscription_url"`
	TokenExpiredAt    *time.Time `json:"token_expired_at"`
	TokenExpired      bool       `json:"token_expired"`
	DaysUntilExpiry   *int       `json:"days_until_expiry"`
	HasCustomConfig   bool       `json:"has_custom_config"`
	HasConfigTemplate bool       `json:"has_config_template"`
}

// AccessLogEntry 访问日志条目（含订阅名）
type AccessLogEntry struct {
	model.AccessLog
	SubscriptionName string `json:"subscription_name"`
}

// DashboardStats 仪表板统计数据（含详细状态）
type DashboardStats struct {
	TotalProviders       int64                `json:"total_providers"`
	TotalSubscriptions   int64                `json:"total_subscriptions"`
	TotalCustomConfigs   int64                `json:"total_custom_configs"`
	TotalConfigTemplates int64                `json:"total_config_templates"`
	TotalRuleProviders   int64                `json:"total_rule_providers"`
	Providers            []ProviderStatus     `json:"providers"`
	Subscriptions        []SubscriptionHealth `json:"subscriptions"`
	RecentAccessLogs     []AccessLogEntry     `json:"recent_access_logs"`
}

// GetDashboardStats 获取当前用户的仪表板统计数据
func GetDashboardStats(c *gin.Context) {
	userID := middleware.CurrentUserID(c)

	var stats DashboardStats

	repository.DB.Model(&model.Provider{}).Where("user_id = ?", userID).Count(&stats.TotalProviders)
	repository.DB.Model(&model.Subscription{}).Where("user_id = ?", userID).Count(&stats.TotalSubscriptions)
	repository.DB.Model(&model.CustomConfig{}).Where("user_id = ?", userID).Count(&stats.TotalCustomConfigs)
	repository.DB.Model(&model.ConfigTemplate{}).Where("user_id = ?", userID).Count(&stats.TotalConfigTemplates)
	// 用户自定义的规则集（不含系统预设）
	repository.DB.Model(&model.RuleProvider{}).Where("user_id = ?", userID).Count(&stats.TotalRuleProviders)

	// Provider 缓存状态
	var providers []model.Provider
	repository.DB.Where("user_id = ?", userID).Find(&providers)
	stats.Providers = make([]ProviderStatus, 0, len(providers))
	for _, p := range providers {
		stats.Providers = append(stats.Providers, ProviderStatus{
			ID:            p.ID,
			Name:          p.Name,
			Type:          p.Type,
			URL:           p.URL,
			UpdatedAt:     p.UpdatedAt,
			LastFetchedAt: p.LastFetchedAt,
			FetchError:    p.FetchError,
			CacheStale:    service.IsCacheStale(&p),
		})
	}

	// 订阅健康状态
	var subs []model.Subscription
	repository.DB.Where("user_id = ?", userID).Find(&subs)
	stats.Subscriptions = make([]SubscriptionHealth, 0, len(subs))
	now := time.Now()
	for _, sub := range subs {
		h := SubscriptionHealth{
			ID:                sub.ID,
			Name:              sub.Name,
			SubscriptionURL:   "",
			TokenExpiredAt:    sub.TokenExpiredAt,
			TokenExpired:      sub.TokenExpiredAt != nil && now.After(*sub.TokenExpiredAt),
			HasCustomConfig:   sub.CustomConfigID != nil,
			HasConfigTemplate: sub.ConfigTemplateID != nil,
		}
		// 填充订阅链接
		tmpSub := sub
		fillSubscriptionURL(&tmpSub)
		h.SubscriptionURL = tmpSub.SubscriptionURL

		if sub.TokenExpiredAt != nil && !h.TokenExpired {
			days := int(sub.TokenExpiredAt.Sub(now).Hours() / 24)
			h.DaysUntilExpiry = &days
		}
		stats.Subscriptions = append(stats.Subscriptions, h)
	}

	// 最近访问日志（跨所有订阅，附带订阅名）
	subNameMap := make(map[uint]string, len(subs))
	var subIDs []uint
	for _, s := range subs {
		subIDs = append(subIDs, s.ID)
		subNameMap[s.ID] = s.Name
	}
	stats.RecentAccessLogs = []AccessLogEntry{}
	if len(subIDs) > 0 {
		var logs []model.AccessLog
		repository.DB.Where("subscription_id IN ?", subIDs).
			Order("id DESC").
			Limit(20).
			Find(&logs)
		for _, l := range logs {
			stats.RecentAccessLogs = append(stats.RecentAccessLogs, AccessLogEntry{
				AccessLog:        l,
				SubscriptionName: subNameMap[l.SubscriptionID],
			})
		}
	}

	OK(c, &stats)
}

// RefreshAllProviders 一键刷新当前用户所有 Provider 缓存
func RefreshAllProviders(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var providers []model.Provider
	repository.DB.Where("user_id = ?", userID).Find(&providers)
	for _, p := range providers {
		service.AsyncRefresh(p.ID)
	}
	OKMsg(c, "已触发所有订阅源刷新", gin.H{"count": len(providers)})
}
