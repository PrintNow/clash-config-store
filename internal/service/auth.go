package service

import (
	"errors"

	"clash-config-store/internal/model"
	"clash-config-store/internal/repository"
	"clash-config-store/internal/util"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// Register 注册新用户，返回 JWT token 和用户信息
// skipRegistrationCheck=true 时跳过注册开关检查（管理员创建用户时使用）
func Register(email, name, password string, skipRegistrationCheck bool) (string, *model.User, error) {
	if !skipRegistrationCheck {
		var setting model.SystemSetting
		if err := repository.DB.Where("key = ?", "allow_registration").First(&setting).Error; err == nil {
			if setting.Value != "true" {
				return "", nil, errors.New("注册已关闭")
			}
		}
	}

	// 检查邮箱是否已被注册
	var existing model.User
	err := repository.DB.Where("email = ?", email).First(&existing).Error
	if err == nil {
		return "", nil, errors.New("该邮箱已被注册")
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return "", nil, err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", nil, err
	}

	// 第一个注册的用户自动成为管理员
	var userCount int64
	repository.DB.Model(&model.User{}).Count(&userCount)

	user := &model.User{
		Email:        email,
		Name:         name,
		PasswordHash: string(hash),
		IsAdmin:      userCount == 0,
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
