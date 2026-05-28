package handler

import (
	"net/http"
	"strconv"
	"time"

	domsub "clash-config-store/internal/domain/subscription"
	"clash-config-store/internal/middleware"
	"clash-config-store/internal/model"
	"clash-config-store/internal/repository"
	"clash-config-store/internal/util"

	"github.com/gin-gonic/gin"
)

func fillSubscriptionURL(sub *model.Subscription) {
	sub.SubscriptionURL = util.SubscriptionPublicURL(sub.Token)
}

// ListSubscriptions 列出当前用户所有订阅
func ListSubscriptions(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var subs []model.Subscription
	if err := repository.DB.Where("user_id = ?", userID).Find(&subs).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "查询失败")
		return
	}
	for i := range subs {
		fillSubscriptionURL(&subs[i])
	}
	if len(subs) > 0 {
		ids := make([]uint, len(subs))
		for i := range subs {
			ids[i] = subs[i].ID
		}
		type cntRow struct {
			SubscriptionID uint  `gorm:"column:subscription_id"`
			Cnt            int64 `gorm:"column:cnt"`
		}
		var rows []cntRow
		if err := repository.DB.Model(&model.AccessLog{}).
			Select("subscription_id, COUNT(*) AS cnt").
			Where("subscription_id IN ?", ids).
			Group("subscription_id").
			Scan(&rows).Error; err != nil {
			Fail(c, http.StatusInternalServerError, "查询失败")
			return
		}
		bySub := make(map[uint]int64, len(rows))
		for _, r := range rows {
			bySub[r.SubscriptionID] = r.Cnt
		}
		for i := range subs {
			subs[i].AccessLogCount = bySub[subs[i].ID]
		}
	}
	OK(c, subs)
}

type subscriptionRequest struct {
	Name               string     `json:"name" binding:"required"`
	EnabledProviderIDs *[]uint    `json:"enabled_provider_ids"`
	CustomConfigID     *uint      `json:"custom_config_id"`
	ConfigTemplateID   *uint      `json:"config_template_id"`
	RuleInsertMode     string     `json:"rule_insert_mode"`
	ProxyPrefixEnabled bool       `json:"proxy_prefix_enabled"`
	TokenExpiredAt     *time.Time `json:"token_expired_at"`
	DialerProxy        *string    `json:"dialer_proxy"`
}

// CreateSubscription 创建订阅（自动生成 token）
func CreateSubscription(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var req subscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}

	token, err := util.GenerateSubscriptionToken()
	if err != nil {
		Fail(c, http.StatusInternalServerError, "生成 token 失败")
		return
	}

	ids := []uint{}
	if req.EnabledProviderIDs != nil {
		ids = *req.EnabledProviderIDs
	}

	ruleInsertMode := req.RuleInsertMode
	if ruleInsertMode == "" {
		ruleInsertMode = string(model.RuleInsertPrepend)
	}

	sub := &model.Subscription{
		UserID:             userID,
		Name:               req.Name,
		Token:              token,
		TokenExpiredAt:     req.TokenExpiredAt,
		EnabledProviderIDs: domsub.EnabledProviderIDsToStore(ids),
		CustomConfigID:     req.CustomConfigID,
		ConfigTemplateID:   req.ConfigTemplateID,
		RuleInsertMode:     model.RuleInsertMode(ruleInsertMode),
		ProxyPrefixEnabled: req.ProxyPrefixEnabled,
	}
	if req.DialerProxy != nil {
		sub.DialerProxy = *req.DialerProxy
	}

	if err := repository.DB.Create(sub).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "创建失败")
		return
	}

	fillSubscriptionURL(sub)
	OK(c, sub)
}

// GetSubscription 获取订阅详情（含访问限制列表）
func GetSubscription(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var sub model.Subscription
	if err := repository.DB.
		Preload("CustomConfig").
		Preload("ConfigTemplate").
		Where("id = ? AND user_id = ?", id, userID).
		First(&sub).Error; err != nil {
		Fail(c, http.StatusNotFound, "订阅不存在或无权限")
		return
	}

	var restrictions []model.AccessRestriction
	repository.DB.Where("subscription_id = ?", id).Find(&restrictions)

	fillSubscriptionURL(&sub)
	OK(c, gin.H{"subscription": sub, "access_restrictions": restrictions})
}

// UpdateSubscription 更新订阅
func UpdateSubscription(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var sub model.Subscription
	if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&sub).Error; err != nil {
		Fail(c, http.StatusNotFound, "订阅不存在或无权限")
		return
	}

	var req subscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}

	ruleInsertMode := req.RuleInsertMode
	if ruleInsertMode == "" {
		ruleInsertMode = string(model.RuleInsertPrepend)
	}

	sub.Name = req.Name
	sub.EnabledProviderIDs = domsub.PatchEnabledProviderIDs(sub.EnabledProviderIDs, req.EnabledProviderIDs)
	sub.CustomConfigID = req.CustomConfigID
	sub.ConfigTemplateID = req.ConfigTemplateID
	sub.RuleInsertMode = model.RuleInsertMode(ruleInsertMode)
	sub.ProxyPrefixEnabled = req.ProxyPrefixEnabled
	sub.TokenExpiredAt = req.TokenExpiredAt
	sub.DialerProxy = derefString(req.DialerProxy)

	if err := repository.DB.Save(&sub).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "更新失败")
		return
	}

	fillSubscriptionURL(&sub)
	OK(c, sub)
}

// DeleteSubscription 删除订阅
func DeleteSubscription(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var sub model.Subscription
	if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&sub).Error; err != nil {
		Fail(c, http.StatusNotFound, "订阅不存在或无权限")
		return
	}

	if err := repository.DB.Delete(&sub).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "删除失败")
		return
	}
	OKMsg(c, "删除成功", nil)
}

// RegenerateToken 重新生成订阅访问 token
func RegenerateToken(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var sub model.Subscription
	if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&sub).Error; err != nil {
		Fail(c, http.StatusNotFound, "订阅不存在或无权限")
		return
	}

	token, err := util.GenerateSubscriptionToken()
	if err != nil {
		Fail(c, http.StatusInternalServerError, "生成 token 失败")
		return
	}

	if err := repository.DB.Model(&sub).Update("token", token).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "更新失败")
		return
	}
	OK(c, gin.H{"token": token})
}

// GetAccessLogs 获取订阅访问日志（分页）
func GetAccessLogs(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var sub model.Subscription
	if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&sub).Error; err != nil {
		Fail(c, http.StatusNotFound, "订阅不存在或无权限")
		return
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	var logs []model.AccessLog
	var total int64
	repository.DB.Model(&model.AccessLog{}).Where("subscription_id = ?", id).Count(&total)
	repository.DB.Where("subscription_id = ?", id).
		Order("id DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&logs)

	OK(c, gin.H{
		"total":     total,
		"page":      page,
		"page_size": pageSize,
		"items":     logs,
	})
}

// ListRestrictions 列出订阅的访问限制规则
func ListRestrictions(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var sub model.Subscription
	if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&sub).Error; err != nil {
		Fail(c, http.StatusNotFound, "订阅不存在或无权限")
		return
	}

	var restrictions []model.AccessRestriction
	repository.DB.Where("subscription_id = ?", id).Find(&restrictions)
	OK(c, restrictions)
}

type restrictionRequest struct {
	Type  string `json:"type" binding:"required"`
	Value string `json:"value" binding:"required"`
	Mode  string `json:"mode" binding:"required"`
}

// CreateRestriction 添加访问限制规则
func CreateRestriction(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var sub model.Subscription
	if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&sub).Error; err != nil {
		Fail(c, http.StatusNotFound, "订阅不存在或无权限")
		return
	}

	var req restrictionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}

	rt := model.RestrictionType(req.Type)
	switch rt {
	case model.RestrictionTypeIP, model.RestrictionTypeCIDR, model.RestrictionTypeCountry:
	default:
		Fail(c, http.StatusBadRequest, "不支持的限制类型")
		return
	}

	restriction := &model.AccessRestriction{
		SubscriptionID: uint(id),
		Type:           rt,
		Value:          req.Value,
		Mode:           model.RestrictionMode(req.Mode),
	}

	if err := repository.DB.Create(restriction).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "创建失败")
		return
	}
	OK(c, restriction)
}

// DeleteRestriction 删除指定访问限制规则
func DeleteRestriction(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}
	rid, err := strconv.ParseUint(c.Param("rid"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的限制 ID")
		return
	}

	var sub model.Subscription
	if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&sub).Error; err != nil {
		Fail(c, http.StatusNotFound, "订阅不存在或无权限")
		return
	}

	var restriction model.AccessRestriction
	if err := repository.DB.Where("id = ? AND subscription_id = ?", rid, id).First(&restriction).Error; err != nil {
		Fail(c, http.StatusNotFound, "限制规则不存在")
		return
	}

	if err := repository.DB.Delete(&restriction).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "删除失败")
		return
	}
	OKMsg(c, "删除成功", nil)
}

func derefString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
