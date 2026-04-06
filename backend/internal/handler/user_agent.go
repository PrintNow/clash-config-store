package handler

import (
	"net/http"
	"strconv"

	"clash-config-store/internal/middleware"
	"clash-config-store/internal/model"
	"clash-config-store/internal/repository"

	"github.com/gin-gonic/gin"
)

// ListUserAgents 列出当前用户的所有 User-Agent
func ListUserAgents(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var agents []model.UserAgent
	if err := repository.DB.Where("user_id = ?", userID).Find(&agents).Error; err != nil {
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

	agent := &model.UserAgent{
		UserID: userID,
		Name:   req.Name,
		Value:  req.Value,
	}

	if err := repository.DB.Create(agent).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "创建失败")
		return
	}

	OK(c, agent)
}

// UpdateUserAgent 更新指定 User-Agent（仅限自己的数据）
func UpdateUserAgent(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var agent model.UserAgent
	if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&agent).Error; err != nil {
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

// DeleteUserAgent 删除指定 User-Agent（仅限自己的数据）
func DeleteUserAgent(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var agent model.UserAgent
	if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&agent).Error; err != nil {
		Fail(c, http.StatusNotFound, "User-Agent 不存在或无权限")
		return
	}

	if err := repository.DB.Delete(&agent).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "删除失败")
		return
	}

	OKMsg(c, "删除成功", nil)
}
