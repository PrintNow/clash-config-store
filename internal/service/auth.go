package service

import (
	"errors"
	"strings"

	"clash-config-store/internal/model"
	"clash-config-store/internal/repository"
	"clash-config-store/internal/util"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// Register 注册新用户，返回 JWT token 和用户信息。
// 若库中尚无任何 root（例如历史数据仅有普通用户），本用户成为 root；常规新装已有内置 root。
func Register(email, name, password string) (string, *model.User, error) {
	allowed, err := IsRegistrationAllowed()
	if err != nil {
		return "", nil, err
	}
	if !allowed {
		return "", nil, errors.New("管理员已关闭用户注册")
	}

	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return "", nil, errors.New("邮箱不能为空")
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

	// 检查邮箱是否已被注册
	var existing model.User
	err = repository.DB.Where("email = ?", email).First(&existing).Error
	if err == nil {
		return "", nil, errors.New("该邮箱已被注册")
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return "", nil, err
	}

	var rootCount int64
	if err := repository.DB.Model(&model.User{}).Where("role = ?", model.RoleRoot).Count(&rootCount).Error; err != nil {
		return "", nil, err
	}
	role := model.RoleUser
	if rootCount == 0 {
		role = model.RoleRoot
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", nil, err
	}

	user := &model.User{
		Email:        email,
		Name:         name,
		PasswordHash: string(hash),
		Role:         role,
	}

	if err := repository.DB.Create(user).Error; err != nil {
		return "", nil, err
	}

	token, err := util.GenerateToken(user.ID, user.Email)
	if err != nil {
		return "", nil, err
	}

	return token, user, nil
}

// Login 用户登录，验证密码后返回 JWT token 和用户信息
func Login(email, password string) (string, *model.User, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	var user model.User
	if err := repository.DB.Where("email = ?", email).First(&user).Error; err != nil {
		// 统一返回模糊错误，防止枚举攻击
		return "", nil, errors.New("邮箱或密码错误")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return "", nil, errors.New("邮箱或密码错误")
	}

	token, err := util.GenerateToken(user.ID, user.Email)
	if err != nil {
		return "", nil, err
	}

	return token, &user, nil
}
