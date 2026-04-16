package handler

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"clash-config-store/internal/middleware"
	"clash-config-store/internal/model"
	"clash-config-store/internal/repository"
	"clash-config-store/internal/util"

	"github.com/gin-gonic/gin"
)

type hostedRuleSetRequest struct {
	Name         string `json:"name" binding:"required"`
	Behavior     string `json:"behavior"`
	Format       string `json:"format"`
	Content      string `json:"content" binding:"required"`
	ShareEnabled bool   `json:"share_enabled"`
}

func ListHostedRuleSets(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var items []model.HostedRuleSet
	if err := repository.DB.Where("user_id = ?", userID).Order("id ASC").Find(&items).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "查询失败")
		return
	}
	for i := range items {
		items[i].ShareURL = hostedRuleSetShareURL(&items[i])
		items[i].Content = ""
		items[i].ContentSHA256 = ""
	}
	OK(c, items)
}

func GetHostedRuleSet(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}
	var item model.HostedRuleSet
	if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&item).Error; err != nil {
		Fail(c, http.StatusNotFound, "规则集不存在或无权限")
		return
	}
	item.ShareURL = hostedRuleSetShareURL(&item)
	OK(c, item)
}

func CreateHostedRuleSet(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var req hostedRuleSetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}
	if err := validateHostedRuleSetRequest(&req); err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	sum := sha256.Sum256([]byte(req.Content))
	item := &model.HostedRuleSet{
		UserID:        userID,
		Name:          strings.TrimSpace(req.Name),
		Behavior:      defaultBehavior(req.Behavior),
		Format:        defaultFormat(req.Format),
		Content:       req.Content,
		ContentSHA256: hex.EncodeToString(sum[:]),
		ShareEnabled:  req.ShareEnabled,
		ShareToken:    nil,
	}
	if item.ShareEnabled {
		token, err := util.GenerateSubscriptionToken()
		if err != nil {
			Fail(c, http.StatusInternalServerError, "生成 token 失败")
			return
		}
		item.ShareToken = &token
	}

	if err := repository.DB.Create(item).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "创建失败")
		return
	}
	item.ShareURL = hostedRuleSetShareURL(item)
	OK(c, item)
}

func UpdateHostedRuleSet(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var item model.HostedRuleSet
	if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&item).Error; err != nil {
		Fail(c, http.StatusNotFound, "规则集不存在或无权限")
		return
	}

	var req hostedRuleSetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}
	if err := validateHostedRuleSetRequest(&req); err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	sum := sha256.Sum256([]byte(req.Content))
	item.Name = strings.TrimSpace(req.Name)
	item.Behavior = defaultBehavior(req.Behavior)
	item.Format = defaultFormat(req.Format)
	item.Content = req.Content
	item.ContentSHA256 = hex.EncodeToString(sum[:])
	item.ShareEnabled = req.ShareEnabled

	if item.ShareEnabled && item.ShareToken == nil {
		token, err := util.GenerateSubscriptionToken()
		if err != nil {
			Fail(c, http.StatusInternalServerError, "生成 token 失败")
			return
		}
		item.ShareToken = &token
	}

	if err := repository.DB.Save(&item).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "更新失败")
		return
	}
	item.ShareURL = hostedRuleSetShareURL(&item)
	OK(c, item)
}

func DeleteHostedRuleSet(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var item model.HostedRuleSet
	if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&item).Error; err != nil {
		Fail(c, http.StatusNotFound, "规则集不存在或无权限")
		return
	}
	if err := repository.DB.Delete(&item).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "删除失败")
		return
	}
	OKMsg(c, "删除成功", nil)
}

func EnableHostedRuleSetShare(c *gin.Context) {
	updateHostedRuleSetShare(c, true, false)
}

func DisableHostedRuleSetShare(c *gin.Context) {
	updateHostedRuleSetShare(c, false, false)
}

func ResetHostedRuleSetToken(c *gin.Context) {
	updateHostedRuleSetShare(c, true, true)
}

func updateHostedRuleSetShare(c *gin.Context, enabled bool, resetToken bool) {
	userID := middleware.CurrentUserID(c)
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		Fail(c, http.StatusBadRequest, "无效的 ID")
		return
	}

	var item model.HostedRuleSet
	if err := repository.DB.Where("id = ? AND user_id = ?", id, userID).First(&item).Error; err != nil {
		Fail(c, http.StatusNotFound, "规则集不存在或无权限")
		return
	}

	item.ShareEnabled = enabled
	if enabled && (item.ShareToken == nil || resetToken) {
		token, err := util.GenerateSubscriptionToken()
		if err != nil {
			Fail(c, http.StatusInternalServerError, "生成 token 失败")
			return
		}
		item.ShareToken = &token
	}
	if err := repository.DB.Save(&item).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "更新失败")
		return
	}
	item.ShareURL = hostedRuleSetShareURL(&item)
	OK(c, item)
}

func hostedRuleSetShareURL(rs *model.HostedRuleSet) string {
	if rs == nil || !rs.ShareEnabled || rs.ShareToken == nil {
		return ""
	}
	return util.RuleSetPublicURL(*rs.ShareToken)
}

func defaultFormat(v string) string {
	if strings.TrimSpace(v) == "" {
		return "yaml"
	}
	return strings.TrimSpace(v)
}

func defaultBehavior(v string) string {
	if strings.TrimSpace(v) == "" {
		return "domain"
	}
	return strings.TrimSpace(v)
}

func validateHostedRuleSetRequest(req *hostedRuleSetRequest) error {
	req.Format = strings.TrimSpace(req.Format)
	req.Behavior = strings.TrimSpace(req.Behavior)
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return fmt.Errorf("name 不能为空")
	}
	if strings.TrimSpace(req.Content) == "" {
		return fmt.Errorf("content 不能为空")
	}
	if req.Format != "" {
		switch req.Format {
		case "yaml", "text":
		default:
			return fmt.Errorf("format 无效，可选: yaml | text")
		}
	}
	if req.Behavior != "" {
		switch req.Behavior {
		case "domain", "ipcidr", "classical":
		default:
			return fmt.Errorf("behavior 无效，可选: domain | ipcidr | classical")
		}
	}
	return nil
}
