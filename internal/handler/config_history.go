package handler

import (
	"log/slog"
	"net/http"
	"strconv"

	"clash-config-store/internal/middleware"
	"clash-config-store/internal/model"
	"clash-config-store/internal/repository"

	"github.com/gin-gonic/gin"
)

// GetConfigHistories 获取自定义配置的变更历史列表
// GET /api/custom-configs/:id/history
func GetConfigHistories(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	// 校验配置归属
	var cfg model.CustomConfig
	if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&cfg).Error; err != nil {
		Fail(c, http.StatusNotFound, "配置不存在或无权限")
		return
	}

	var histories []model.ConfigHistory
	if err := repository.DB.
		Where("custom_config_id = ? AND user_id = ?", id, userID).
		Order("created_at DESC").
		Limit(20).
		Find(&histories).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "查询失败")
		return
	}

	// 将 nil 切片归一化为空切片
	for i := range histories {
		normalizeConfigHistory(&histories[i])
	}

	OK(c, histories)
}

// RestoreConfigHistory 恢复自定义配置到历史版本
// POST /api/custom-configs/:id/history/:hid/restore
func RestoreConfigHistory(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的配置 ID")
		return
	}
	hid, err := strconv.ParseUint(c.Param("hid"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的历史记录 ID")
		return
	}

	// 校验配置归属
	var cfg model.CustomConfig
	if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&cfg).Error; err != nil {
		Fail(c, http.StatusNotFound, "配置不存在或无权限")
		return
	}

	// 校验历史记录归属
	var history model.ConfigHistory
	if err := repository.DB.Where("id = ? AND custom_config_id = ? AND user_id = ?", hid, id, userID).First(&history).Error; err != nil {
		Fail(c, http.StatusNotFound, "历史记录不存在或无权限")
		return
	}

	// 将历史快照写回配置
	cfg.ProxyGroups = history.ProxyGroups
	cfg.Rules = history.Rules
	cfg.RuleProviderIDs = history.RuleProviderIDs
	cfg.HostedRuleSetIDs = history.HostedRuleSetIDs

	if err := repository.DB.Save(&cfg).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "恢复失败")
		return
	}

	// 恢复操作本身也保存一条历史记录（异步）
	go func(saved model.CustomConfig) {
		h := model.ConfigHistory{
			CustomConfigID:   saved.ID,
			UserID:           saved.UserID,
			Name:             saved.Name,
			ProxyGroups:      saved.ProxyGroups,
			Rules:            saved.Rules,
			RuleProviderIDs:  saved.RuleProviderIDs,
			HostedRuleSetIDs: saved.HostedRuleSetIDs,
		}
		if err := repository.DB.Create(&h).Error; err != nil {
			slog.Error("保存恢复历史记录失败", slog.String("component", "config_history"), slog.Uint64("config_id", uint64(saved.ID)), slog.Any("err", err))
		}
		pruneConfigHistory(saved.ID)
	}(cfg)

	normalizeCustomConfig(&cfg)
	OK(c, cfg)
}

// normalizeConfigHistory 将 nil 切片统一为空切片
func normalizeConfigHistory(h *model.ConfigHistory) {
	if h.ProxyGroups == nil {
		h.ProxyGroups = []map[string]interface{}{}
	}
	if h.Rules == nil {
		h.Rules = []string{}
	}
	if h.RuleProviderIDs == nil {
		h.RuleProviderIDs = []uint{}
	}
	if h.HostedRuleSetIDs == nil {
		h.HostedRuleSetIDs = []uint{}
	}
}

// pruneConfigHistory 保留最近 20 条，删除更早的
func pruneConfigHistory(configID uint) {
	var oldest []model.ConfigHistory
	if err := repository.DB.Where("custom_config_id = ?", configID).
		Order("created_at DESC").
		Offset(20).
		Find(&oldest).Error; err != nil {
		slog.Error("查询历史记录失败", slog.String("component", "config_history"), slog.Uint64("config_id", uint64(configID)), slog.Any("err", err))
		return
	}
	for _, h := range oldest {
		if err := repository.DB.Delete(&h).Error; err != nil {
			slog.Error("删除历史记录失败", slog.String("component", "config_history"), slog.Uint64("history_id", uint64(h.ID)), slog.Any("err", err))
		}
	}
}
