package handler

import (
	"errors"
	"net/http"
	"strconv"

	"clash-config-store/internal/middleware"
	"clash-config-store/internal/model"
	"clash-config-store/internal/repository"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// ListUserAgents 列出当前用户的 UA + 系统内置预设
func ListUserAgents(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var agents []model.UserAgent
	if err := repository.DB.Where("user_id = ? OR is_preset = ?", userID, true).
		Order("is_preset DESC, id ASC").
		Find(&agents).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "查询失败")
		return
	}
	OK(c, agents)
}

type userAgentRequest struct {
	Name  string `json:"name" binding:"required"`
	Value string `json:"value" binding:"required"`
}

// CreateUserAgent 创建 User-Agent
func CreateUserAgent(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var req userAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}

	uid := userID
	agent := &model.UserAgent{
		UserID:   &uid,
		Name:     req.Name,
		Value:    req.Value,
		IsPreset: false,
	}

	if err := repository.DB.Create(agent).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "创建失败")
		return
	}

	OK(c, agent)
}

// UpdateUserAgent 更新自定义 UA（内置预设不可修改）
func UpdateUserAgent(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var agent model.UserAgent
	if err := repository.DB.First(&agent, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			Fail(c, http.StatusNotFound, "User-Agent 不存在或无权限")
			return
		}
		Fail(c, http.StatusInternalServerError, "查询失败")
		return
	}
	if agent.IsPreset {
		Fail(c, http.StatusForbidden, "内置预设不可修改")
		return
	}
	if agent.UserID == nil || *agent.UserID != userID {
		Fail(c, http.StatusNotFound, "User-Agent 不存在或无权限")
		return
	}

	var req userAgentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}

	agent.Name = req.Name
	agent.Value = req.Value

	if err := repository.DB.Save(&agent).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "更新失败")
		return
	}

	OK(c, agent)
}

// DeleteUserAgent 删除自定义 UA（内置预设不可删除）
func DeleteUserAgent(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var agent model.UserAgent
	if err := repository.DB.First(&agent, id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			Fail(c, http.StatusNotFound, "User-Agent 不存在或无权限")
			return
		}
		Fail(c, http.StatusInternalServerError, "查询失败")
		return
	}
	if agent.IsPreset {
		Fail(c, http.StatusForbidden, "内置预设不可删除")
		return
	}
	if agent.UserID == nil || *agent.UserID != userID {
		Fail(c, http.StatusNotFound, "User-Agent 不存在或无权限")
		return
	}

	if err := repository.DB.Delete(&agent).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "删除失败")
		return
	}

	OKMsg(c, "删除成功", nil)
}
