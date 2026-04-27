package service

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"unicode/utf8"

	"clash-config-store/internal/model"
	"clash-config-store/internal/repository"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// IsRegistrationAllowed 是否允许开放注册（读站点配置，缺省 false）。
// 全新部署由 SeedDefaultAdminIfEmpty 写入内置账号，不依赖「零用户时放行注册」。
func IsRegistrationAllowed() (bool, error) {
	var s model.SiteSetting
	err := repository.DB.Where(&model.SiteSetting{Key: model.SettingAllowRegistration}).First(&s).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return strings.EqualFold(strings.TrimSpace(s.Value), "true"), nil
}

// ListUsers 分页列出用户
func ListUsers(page, pageSize int) ([]model.User, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	var total int64
	if err := repository.DB.Model(&model.User{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var users []model.User
	offset := (page - 1) * pageSize
	if err := repository.DB.Order("id ASC").Offset(offset).Limit(pageSize).Find(&users).Error; err != nil {
		return nil, 0, err
	}
	return users, total, nil
}

// UpdateUserRole 修改用户角色（不可修改 root）
func UpdateUserRole(actorID uint, targetID uint, role string) error {
	role = strings.TrimSpace(role)
	switch role {
	case model.RoleRoot, model.RoleAdmin, model.RoleUser:
	default:
		return fmt.Errorf("无效的角色: %s", role)
	}

	var actor model.User
	if err := repository.DB.First(&actor, actorID).Error; err != nil {
		return err
	}
	if actor.Role != model.RoleRoot {
		return errors.New("仅超级管理员可修改角色")
	}

	var target model.User
	if err := repository.DB.First(&target, targetID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("用户不存在")
		}
		return err
	}
	if target.Role == model.RoleRoot {
		return errors.New("不可修改超级管理员角色")
	}
	if targetID == actorID {
		return errors.New("不可修改自己的角色")
	}

	return repository.DB.Model(&target).Update("role", role).Error
}

// GetAllSiteSettings 返回所有站点配置（KV）
func GetAllSiteSettings() (map[string]string, error) {
	var rows []model.SiteSetting
	if err := repository.DB.Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make(map[string]string, len(rows))
	for _, r := range rows {
		out[r.Key] = r.Value
	}
	return out, nil
}

// UpdateSiteSettings 合并更新站点配置（仅允许已知 key）
func UpdateSiteSettings(updates map[string]string) error {
	for k, v := range updates {
		k = strings.TrimSpace(k)
		if k != model.SettingAllowRegistration {
			continue
		}
		v = strings.TrimSpace(v)
		if v != "true" && v != "false" {
			return fmt.Errorf("allow_registration 仅可为 true 或 false")
		}
		var s model.SiteSetting
		err := repository.DB.Where(&model.SiteSetting{Key: k}).First(&s).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if err := repository.DB.Create(&model.SiteSetting{Key: k, Value: v}).Error; err != nil {
				return err
			}
			continue
		}
		if err != nil {
			return err
		}
		if err := repository.DB.Model(&s).Update("value", v).Error; err != nil {
			return err
		}
	}
	return nil
}

// CreateUser 管理员创建用户（actor 为 root 时可设任意角色，admin 仅可建 user/admin）
func CreateUser(actorID uint, email, name, password, role string) (*model.User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return nil, errors.New("邮箱不能为空")
	}
	if !strings.Contains(email, "@") {
		return nil, errors.New("邮箱格式无效")
	}
	if utf8.RuneCountInString(password) < 6 {
		return nil, errors.New("密码至少 6 个字符")
	}

	role = strings.TrimSpace(role)
	if role == "" {
		role = model.RoleUser
	}
	var actor model.User
	if err := repository.DB.First(&actor, actorID).Error; err != nil {
		return nil, err
	}
	if !canAssignRoleOnCreate(&actor, role) {
		return nil, errors.New("无权创建该角色")
	}

	if strings.TrimSpace(name) == "" {
		if i := strings.IndexByte(email, '@'); i > 0 {
			name = email[:i]
		} else {
			name = email
		}
	} else {
		name = strings.TrimSpace(name)
	}

	var dup model.User
	if err := repository.DB.Where("email = ?", email).First(&dup).Error; err == nil {
		return nil, errors.New("该邮箱已被使用")
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	u := &model.User{
		Email:        email,
		Name:         name,
		PasswordHash: string(hash),
		Role:         role,
	}
	if err := repository.DB.Create(u).Error; err != nil {
		return nil, err
	}
	return u, nil
}

func canAssignRoleOnCreate(actor *model.User, role string) bool {
	switch role {
	case model.RoleUser, model.RoleAdmin, model.RoleRoot:
	default:
		return false
	}
	if actor.Role == model.RoleRoot {
		return true
	}
	if actor.Role == model.RoleAdmin {
		return role == model.RoleUser || role == model.RoleAdmin
	}
	return false
}

// DeleteUser 删除用户（不可删自己、不可删任何 root）
func DeleteUser(actorID, targetID uint) error {
	if actorID == targetID {
		return errors.New("不能删除自己的账号")
	}
	var target model.User
	if err := repository.DB.First(&target, targetID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("用户不存在")
		}
		return err
	}
	if target.Role == model.RoleRoot {
		return errors.New("不能删除超级管理员")
	}
	var actor model.User
	if err := repository.DB.First(&actor, actorID).Error; err != nil {
		return err
	}
	// 管理员不可删除其他管理员
	if actor.Role == model.RoleAdmin && target.Role == model.RoleAdmin {
		return errors.New("仅超级管理员可删除管理员")
	}
	return repository.DB.Delete(&model.User{}, targetID).Error
}

// UpdateUserByAdmin 更新用户资料，可选新密码
func UpdateUserByAdmin(actorID, targetID uint, name, email, newPassword *string) (*model.User, error) {
	var actor, target model.User
	if err := repository.DB.First(&actor, actorID).Error; err != nil {
		return nil, err
	}
	if err := repository.DB.First(&target, targetID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("用户不存在")
		}
		return nil, err
	}
	if target.Role == model.RoleRoot && actor.Role != model.RoleRoot {
		return nil, errors.New("仅超级管理员可编辑该用户")
	}
	if name == nil && email == nil && (newPassword == nil || *newPassword == "") {
		return nil, errors.New("请至少提供一项要修改的内容")
	}
	if name != nil {
		n := strings.TrimSpace(*name)
		if n == "" {
			return nil, errors.New("用户名不能为空")
		}
		target.Name = n
	}
	if email != nil {
		e := strings.ToLower(strings.TrimSpace(*email))
		if e == "" {
			return nil, errors.New("邮箱不能为空")
		}
		if e != target.Email {
			var cnt int64
			repository.DB.Model(&model.User{}).Where("email = ? AND id != ?", e, targetID).Count(&cnt)
			if cnt > 0 {
				return nil, errors.New("该邮箱已被使用")
			}
			target.Email = e
		}
	}
	if newPassword != nil && *newPassword != "" {
		if utf8.RuneCountInString(*newPassword) < 6 {
			return nil, errors.New("密码至少 6 个字符")
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(*newPassword), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		target.PasswordHash = string(hash)
	}
	if err := repository.DB.Save(&target).Error; err != nil {
		return nil, err
	}
	return &target, nil
}

// ParsePageParams 解析分页 query，默认 page=1, pageSize=20
func ParsePageParams(pageStr, pageSizeStr string) (page, pageSize int) {
	page = 1
	pageSize = 20
	if p, err := strconv.Atoi(strings.TrimSpace(pageStr)); err == nil && p > 0 {
		page = p
	}
	if ps, err := strconv.Atoi(strings.TrimSpace(pageSizeStr)); err == nil && ps > 0 {
		pageSize = ps
	}
	return page, pageSize
}
