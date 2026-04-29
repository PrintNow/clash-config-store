package handler

import (
	"net/http"
	"strconv"

	"clash-config-store/internal/middleware"
	"clash-config-store/internal/model"
	"clash-config-store/internal/service"

	"github.com/gin-gonic/gin"
)

// ListUsers GET /admin/users
func ListUsers(c *gin.Context) {
	page, pageSize := service.ParsePageParams(c.Query("page"), c.Query("page_size"))
	users, total, err := service.ListUsers(page, pageSize)
	if err != nil {
		Fail(c, http.StatusInternalServerError, "加载用户列表失败")
		return
	}
	OK(c, gin.H{
		"items":     users,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

type updateUserRoleRequest struct {
	Role string `json:"role" binding:"required"`
}

// UpdateUserRole PATCH /admin/users/:id/role（仅 root）
func UpdateUserRole(c *gin.Context) {
	idStr := c.Param("id")
	id64, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的用户 ID")
		return
	}
	var req updateUserRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}
	actorID := middleware.CurrentUserID(c)
	if err := service.UpdateUserRole(actorID, uint(id64), req.Role); err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	OKMsg(c, "已更新角色", nil)
}

type createUserRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Name     string `json:"name"`
	Password string `json:"password" binding:"required,min=6"`
	Role     string `json:"role"`
}

// CreateUser POST /admin/users
func CreateUser(c *gin.Context) {
	var req createUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}
	uid := middleware.CurrentUserID(c)
	u, err := service.CreateUser(uid, req.Email, req.Name, req.Password, req.Role)
	if err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	OK(c, u)
}

// DeleteUser DELETE /admin/users/:id
func DeleteUser(c *gin.Context) {
	id64, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的用户 ID")
		return
	}
	uid := middleware.CurrentUserID(c)
	if err := service.DeleteUser(uid, uint(id64)); err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	OKMsg(c, "已删除", nil)
}

type updateUserRequest struct {
	Name     *string `json:"name"`
	Email    *string `json:"email"`
	Password *string `json:"password"`
}

// UpdateUser PUT /admin/users/:id
func UpdateUser(c *gin.Context) {
	id64, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的用户 ID")
		return
	}
	var req updateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}
	uid := middleware.CurrentUserID(c)
	u, err := service.UpdateUserByAdmin(uid, uint(id64), req.Name, req.Email, req.Password)
	if err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	OK(c, u)
}

// GetSiteSettings GET /admin/settings
func GetSiteSettings(c *gin.Context) {
	m, err := service.GetAllSiteSettings()
	if err != nil {
		Fail(c, http.StatusInternalServerError, "读取配置失败")
		return
	}
	OK(c, m)
}

type updateSiteSettingsRequest struct {
	AllowRegistration *bool `json:"allow_registration"`
}

// UpdateSiteSettings PUT /admin/settings
func UpdateSiteSettings(c *gin.Context) {
	var req updateSiteSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}
	if req.AllowRegistration == nil {
		Fail(c, http.StatusBadRequest, "缺少 allow_registration")
		return
	}
	v := "false"
	if *req.AllowRegistration {
		v = "true"
	}
	if err := service.UpdateSiteSettings(map[string]string{model.SettingAllowRegistration: v}); err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}
	OKMsg(c, "已保存", nil)
}

// GetRegistrationStatus GET /public/registration-status
func GetRegistrationStatus(c *gin.Context) {
	allowed, err := service.IsRegistrationAllowed()
	if err != nil {
		Fail(c, http.StatusInternalServerError, "读取配置失败")
		return
	}
	OK(c, gin.H{"allowed": allowed})
}
