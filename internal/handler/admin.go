package handler

import (
	"net/http"
	"strconv"
	"time"

	"clash-config-store/internal/config"
	"clash-config-store/internal/middleware"
	"clash-config-store/internal/model"
	"clash-config-store/internal/repository"
	"clash-config-store/internal/service"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

// AdminUserItem 用户列表项（含统计数据）
type AdminUserItem struct {
	ID                uint      `json:"id"`
	Name              string    `json:"name"`
	Email             string    `json:"email"`
	IsAdmin           bool      `json:"is_admin"`
	CreatedAt         time.Time `json:"created_at"`
	ProviderCount     int64     `json:"provider_count"`
	SubscriptionCount int64     `json:"subscription_count"`
	CustomConfigCount int64     `json:"custom_config_count"`
}

// AdminSystemSettings 系统设置响应
type AdminSystemSettings struct {
	AllowRegistration      bool   `json:"allow_registration"`
	BaseURL                string `json:"base_url"`
	DefaultTokenExpiryDays int    `json:"default_token_expiry_days"`
}

// GetSystemSettings 获取系统设置
func GetSystemSettings(c *gin.Context) {
	allowReg := repository.GetSetting("allow_registration", "true") == "true"
	baseURL := repository.GetSetting("base_url", "")
	expiryDays, _ := strconv.Atoi(repository.GetSetting("default_token_expiry_days", "0"))
	OK(c, AdminSystemSettings{
		AllowRegistration:      allowReg,
		BaseURL:                baseURL,
		DefaultTokenExpiryDays: expiryDays,
	})
}

type updateSystemSettingsRequest struct {
	AllowRegistration      bool   `json:"allow_registration"`
	BaseURL                string `json:"base_url"`
	DefaultTokenExpiryDays int    `json:"default_token_expiry_days"`
}

// UpdateSystemSettings 更新系统设置
func UpdateSystemSettings(c *gin.Context) {
	var req updateSystemSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}

	allowRegVal := "false"
	if req.AllowRegistration {
		allowRegVal = "true"
	}

	updates := map[string]string{
		"allow_registration":       allowRegVal,
		"base_url":                 req.BaseURL,
		"default_token_expiry_days": strconv.Itoa(req.DefaultTokenExpiryDays),
	}
	for k, v := range updates {
		if err := repository.SetSetting(k, v); err != nil {
			Fail(c, http.StatusInternalServerError, "更新失败")
			return
		}
	}

	// base_url 变更时立即生效，无需重启
	if req.BaseURL != "" {
		config.App.BaseURL = req.BaseURL
	} else {
		// 清空时恢复到启动时的环境变量值（保持当前内存值不变，重启后生效）
	}

	OK(c, AdminSystemSettings{
		AllowRegistration:      req.AllowRegistration,
		BaseURL:                req.BaseURL,
		DefaultTokenExpiryDays: req.DefaultTokenExpiryDays,
	})
}

// ListAdminUsers 获取全部用户列表（含资源统计）
func ListAdminUsers(c *gin.Context) {
	var users []model.User
	if err := repository.DB.Find(&users).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "查询失败")
		return
	}

	// 提取所有用户 ID，用于 IN 条件
	userIDs := make([]uint, 0, len(users))
	for _, u := range users {
		userIDs = append(userIDs, u.ID)
	}

	// 聚合结构体（内部使用）
	type countRow struct {
		UserID uint  `gorm:"column:user_id"`
		Cnt    int64 `gorm:"column:cnt"`
	}

	// 三次聚合查询
	var provRows, subRows, cfgRows []countRow
	if len(userIDs) > 0 {
		repository.DB.Model(&model.Provider{}).
			Select("user_id, COUNT(*) AS cnt").
			Where("user_id IN ?", userIDs).
			Group("user_id").
			Scan(&provRows)
		repository.DB.Model(&model.Subscription{}).
			Select("user_id, COUNT(*) AS cnt").
			Where("user_id IN ?", userIDs).
			Group("user_id").
			Scan(&subRows)
		repository.DB.Model(&model.CustomConfig{}).
			Select("user_id, COUNT(*) AS cnt").
			Where("user_id IN ?", userIDs).
			Group("user_id").
			Scan(&cfgRows)
	}

	// 转换为 map 以便 O(1) 查找
	provMap := make(map[uint]int64, len(provRows))
	for _, r := range provRows {
		provMap[r.UserID] = r.Cnt
	}
	subMap := make(map[uint]int64, len(subRows))
	for _, r := range subRows {
		subMap[r.UserID] = r.Cnt
	}
	cfgMap := make(map[uint]int64, len(cfgRows))
	for _, r := range cfgRows {
		cfgMap[r.UserID] = r.Cnt
	}

	items := make([]AdminUserItem, 0, len(users))
	for _, u := range users {
		items = append(items, AdminUserItem{
			ID:                u.ID,
			Name:              u.Name,
			Email:             u.Email,
			IsAdmin:           u.IsAdmin,
			CreatedAt:         u.CreatedAt,
			ProviderCount:     provMap[u.ID],
			SubscriptionCount: subMap[u.ID],
			CustomConfigCount: cfgMap[u.ID],
		})
	}

	OK(c, items)
}

// GetAdminUser 获取单个用户详情
func GetAdminUser(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的用户 ID")
		return
	}

	var user model.User
	if err := repository.DB.First(&user, id).Error; err != nil {
		Fail(c, http.StatusNotFound, "用户不存在")
		return
	}

	var providerCount, subCount, configCount int64
	if err := repository.DB.Model(&model.Provider{}).Where("user_id = ?", user.ID).Count(&providerCount).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "查询失败")
		return
	}
	if err := repository.DB.Model(&model.Subscription{}).Where("user_id = ?", user.ID).Count(&subCount).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "查询失败")
		return
	}
	if err := repository.DB.Model(&model.CustomConfig{}).Where("user_id = ?", user.ID).Count(&configCount).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "查询失败")
		return
	}

	OK(c, AdminUserItem{
		ID:                user.ID,
		Name:              user.Name,
		Email:             user.Email,
		IsAdmin:           user.IsAdmin,
		CreatedAt:         user.CreatedAt,
		ProviderCount:     providerCount,
		SubscriptionCount: subCount,
		CustomConfigCount: configCount,
	})
}

type adminUpdateUserRequest struct {
	Name     string `json:"name"`
	Email    string `json:"email" binding:"omitempty,email"`
	IsAdmin  *bool  `json:"is_admin"`
	Password string `json:"password" binding:"omitempty,min=6"`
}

// UpdateAdminUser 修改用户信息（管理员操作）
func UpdateAdminUser(c *gin.Context) {
	currentUserID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的用户 ID")
		return
	}

	var req adminUpdateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}

	var user model.User
	if err := repository.DB.First(&user, id).Error; err != nil {
		Fail(c, http.StatusNotFound, "用户不存在")
		return
	}

	// 防止撤销最后一个管理员
	if req.IsAdmin != nil && !*req.IsAdmin && user.IsAdmin {
		var adminCount int64
		repository.DB.Model(&model.User{}).Where("is_admin = ? AND id != ?", true, id).Count(&adminCount)
		if adminCount == 0 {
			Fail(c, http.StatusBadRequest, "系统中至少需要保留一个管理员")
			return
		}
	}

	if req.Name != "" {
		user.Name = req.Name
	}

	if req.Email != "" && req.Email != user.Email {
		var count int64
		repository.DB.Model(&model.User{}).Where("email = ? AND id != ?", req.Email, id).Count(&count)
		if count > 0 {
			Fail(c, http.StatusBadRequest, "该邮箱已被使用")
			return
		}
		user.Email = req.Email
	}

	if req.IsAdmin != nil {
		user.IsAdmin = *req.IsAdmin
	}

	if req.Password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			Fail(c, http.StatusInternalServerError, "密码加密失败")
			return
		}
		user.PasswordHash = string(hash)
	}

	if err := repository.DB.Save(&user).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "更新失败")
		return
	}

	_ = currentUserID
	OK(c, AdminUserItem{
		ID:        user.ID,
		Name:      user.Name,
		Email:     user.Email,
		IsAdmin:   user.IsAdmin,
		CreatedAt: user.CreatedAt,
	})
}

type adminCreateUserRequest struct {
	Name     string `json:"name" binding:"required"`
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	IsAdmin  bool   `json:"is_admin"`
}

// CreateAdminUser 管理员创建用户
func CreateAdminUser(c *gin.Context) {
	var req adminCreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}

	_, user, err := service.Register(req.Email, req.Name, req.Password, true)
	if err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	if req.IsAdmin {
		if err := repository.DB.Model(user).Update("is_admin", true).Error; err != nil {
			Fail(c, http.StatusInternalServerError, "设置管理员权限失败")
			return
		}
		user.IsAdmin = true
	}

	OK(c, AdminUserItem{
		ID:        user.ID,
		Name:      user.Name,
		Email:     user.Email,
		IsAdmin:   user.IsAdmin,
		CreatedAt: user.CreatedAt,
	})
}

// DeleteAdminUser 删除用户（不可删除自身）
func DeleteAdminUser(c *gin.Context) {
	currentUserID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的用户 ID")
		return
	}

	if uint(id) == currentUserID {
		Fail(c, http.StatusBadRequest, "不能删除自己的账号")
		return
	}

	var user model.User
	if err := repository.DB.First(&user, id).Error; err != nil {
		Fail(c, http.StatusNotFound, "用户不存在")
		return
	}

	// 防止删除最后一个管理员
	if user.IsAdmin {
		var adminCount int64
		repository.DB.Model(&model.User{}).Where("is_admin = ? AND id != ?", true, id).Count(&adminCount)
		if adminCount == 0 {
			Fail(c, http.StatusBadRequest, "系统中至少需要保留一个管理员")
			return
		}
	}

	if err := repository.DB.Delete(&user).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "删除失败")
		return
	}

	OKMsg(c, "用户已删除", nil)
}
