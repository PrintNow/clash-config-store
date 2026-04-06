package handler

import (
	"clash-config-store/internal/middleware"
	"clash-config-store/internal/model"
	"clash-config-store/internal/repository"

	"github.com/gin-gonic/gin"
)

// DashboardStats 仪表板统计数据
type DashboardStats struct {
	TotalProviders     int64             `json:"total_providers"`
	TotalSubscriptions int64             `json:"total_subscriptions"`
	TotalCustomConfigs int64             `json:"total_custom_configs"`
	RecentAccessLogs   []model.AccessLog `json:"recent_access_logs"`
}

// GetDashboardStats 获取当前用户的仪表板统计数据
func GetDashboardStats(c *gin.Context) {
	userID := middleware.CurrentUserID(c)

	var stats DashboardStats

	repository.DB.Model(&model.Provider{}).Where("user_id = ?", userID).Count(&stats.TotalProviders)
	repository.DB.Model(&model.Subscription{}).Where("user_id = ?", userID).Count(&stats.TotalSubscriptions)
	repository.DB.Model(&model.CustomConfig{}).Where("user_id = ?", userID).Count(&stats.TotalCustomConfigs)

	// 收集当前用户的所有订阅 ID，用于跨订阅查询日志
	var subIDs []uint
	repository.DB.Model(&model.Subscription{}).
		Where("user_id = ?", userID).
		Pluck("id", &subIDs)

	if len(subIDs) > 0 {
		repository.DB.Where("subscription_id IN ?", subIDs).
			Order("id DESC").
			Limit(20).
			Find(&stats.RecentAccessLogs)
	} else {
		stats.RecentAccessLogs = []model.AccessLog{}
	}

	OK(c, &stats)
}
