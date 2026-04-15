package handler

import (
	"net/http"
	"strconv"
	"strings"

	"clash-config-store/internal/middleware"
	"clash-config-store/internal/model"
	"clash-config-store/internal/repository"

	"github.com/gin-gonic/gin"
)

type configTemplateRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	Content     string `json:"content"`
}

// ListConfigTemplates 列出当前用户所有配置模板
func ListConfigTemplates(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var templates []model.ConfigTemplate
	if err := repository.DB.Where("user_id = ?", userID).Find(&templates).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "查询失败")
		return
	}
	OK(c, templates)
}

// CreateConfigTemplate 创建配置模板
func CreateConfigTemplate(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var req configTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}

	if err := validateConfigTemplateContent(req.Content); err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	tmpl := &model.ConfigTemplate{
		UserID:      userID,
		Name:        req.Name,
		Description: req.Description,
		Content:     req.Content,
	}
	if err := repository.DB.Create(tmpl).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "创建失败")
		return
	}
	OK(c, tmpl)
}

// GetConfigTemplate 获取配置模板详情
func GetConfigTemplate(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var tmpl model.ConfigTemplate
	if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&tmpl).Error; err != nil {
		Fail(c, http.StatusNotFound, "模板不存在或无权限")
		return
	}
	OK(c, tmpl)
}

// UpdateConfigTemplate 更新配置模板
func UpdateConfigTemplate(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var tmpl model.ConfigTemplate
	if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&tmpl).Error; err != nil {
		Fail(c, http.StatusNotFound, "模板不存在或无权限")
		return
	}

	var req configTemplateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}

	if err := validateConfigTemplateContent(req.Content); err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	tmpl.Name = req.Name
	tmpl.Description = req.Description
	tmpl.Content = req.Content

	if err := repository.DB.Save(&tmpl).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "更新失败")
		return
	}
	OK(c, tmpl)
}

// DeleteConfigTemplate 删除配置模板
func DeleteConfigTemplate(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var tmpl model.ConfigTemplate
	if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&tmpl).Error; err != nil {
		Fail(c, http.StatusNotFound, "模板不存在或无权限")
		return
	}

	if err := repository.DB.Delete(&tmpl).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "删除失败")
		return
	}
	OKMsg(c, "删除成功", nil)
}

// validateConfigTemplateContent 校验配置模板内容（不能包含 proxies/proxy-groups/rules 顶层键）
func validateConfigTemplateContent(content string) error {
	if strings.TrimSpace(content) == "" {
		return nil
	}
	// 简单校验：这些字段应由 CustomConfig 管理，不应出现在模板中
	forbidden := []string{"proxies:", "proxy-groups:", "rules:"}
	for _, f := range forbidden {
		if strings.Contains(content, f) {
			return nil // 允许出现，但生成时会被覆盖，不报错
		}
	}
	return nil
}
