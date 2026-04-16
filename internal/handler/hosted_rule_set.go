package handler

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"clash-config-store/internal/middleware"
	"clash-config-store/internal/model"
	"clash-config-store/internal/repository"
	"clash-config-store/internal/util"

	"github.com/gin-gonic/gin"
)

var hostedRuleSetNamePattern = regexp.MustCompile(`^[A-Za-z0-9_-]+$`)

type hostedRuleSetRequest struct {
	Name     string `json:"name" binding:"required"`
	Behavior string `json:"behavior"`
	Format   string `json:"format"`
	Content  string `json:"content" binding:"required"`
}

func ListHostedRuleSets(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var items []model.HostedRuleSet
	if err := repository.DB.Where("user_id = ?", userID).Order("id ASC").Find(&items).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "查询失败")
		return
	}
	for i := range items {
		items[i].URL = hostedRuleSetURL(&items[i])
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
	item.URL = hostedRuleSetURL(&item)
	OK(c, item)
}

func CreateHostedRuleSet(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var req hostedRuleSetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		BindFail(c, err)
		return
	}
	if err := validateHostedRuleSetRequest(userID, 0, &req); err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	token, err := util.GenerateSubscriptionToken()
	if err != nil {
		Fail(c, http.StatusInternalServerError, "生成 token 失败")
		return
	}
	item := buildHostedRuleSetModel(userID, token, req)
	if err := repository.DB.Create(item).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "创建失败")
		return
	}
	item.URL = hostedRuleSetURL(item)
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
	if err := validateHostedRuleSetRequest(userID, item.ID, &req); err != nil {
		Fail(c, http.StatusBadRequest, err.Error())
		return
	}

	sum := sha256.Sum256([]byte(req.Content))
	item.Name = strings.TrimSpace(req.Name)
	item.Behavior = defaultBehavior(req.Behavior)
	item.Format = defaultFormat(req.Format)
	item.Content = req.Content
	item.ContentSHA256 = hex.EncodeToString(sum[:])

	if err := repository.DB.Save(&item).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "更新失败")
		return
	}
	item.URL = hostedRuleSetURL(&item)
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

func ResetHostedRuleSetTokens(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	var items []model.HostedRuleSet
	if err := repository.DB.Where("user_id = ?", userID).Find(&items).Error; err != nil {
		Fail(c, http.StatusInternalServerError, "查询失败")
		return
	}

	for _, item := range items {
		token, err := util.GenerateSubscriptionToken()
		if err != nil {
			Fail(c, http.StatusInternalServerError, "生成 token 失败")
			return
		}
		if err := repository.DB.Model(&model.HostedRuleSet{}).
			Where("id = ? AND user_id = ?", item.ID, userID).
			Update("token", token).Error; err != nil {
			Fail(c, http.StatusInternalServerError, "更新失败")
			return
		}
	}

	OKMsg(c, "已重置全部托管规则集 token", nil)
}

func buildHostedRuleSetModel(userID uint, token string, req hostedRuleSetRequest) *model.HostedRuleSet {
	sum := sha256.Sum256([]byte(req.Content))
	return &model.HostedRuleSet{
		UserID:        userID,
		Name:          strings.TrimSpace(req.Name),
		Behavior:      defaultBehavior(req.Behavior),
		Format:        defaultFormat(req.Format),
		Content:       req.Content,
		ContentSHA256: hex.EncodeToString(sum[:]),
		Token:         token,
	}
}

func hostedRuleSetURL(rs *model.HostedRuleSet) string {
	if rs == nil || rs.Token == "" || rs.Name == "" {
		return ""
	}
	return util.RuleSetPublicURL(rs.Token, rs.Name)
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

func validateHostedRuleSetRequest(userID uint, currentID uint, req *hostedRuleSetRequest) error {
	req.Format = strings.TrimSpace(req.Format)
	req.Behavior = strings.TrimSpace(req.Behavior)
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		return fmt.Errorf("name 不能为空")
	}
	if !hostedRuleSetNamePattern.MatchString(req.Name) {
		return fmt.Errorf("name 仅允许字母、数字、下划线和短横线")
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

	var count int64
	query := repository.DB.Model(&model.HostedRuleSet{}).Where("user_id = ? AND name = ?", userID, req.Name)
	if currentID != 0 {
		query = query.Where("id <> ?", currentID)
	}
	if err := query.Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return fmt.Errorf("名称已存在")
	}
	return nil
}
