package model

// 用户角色
const (
	RoleRoot  = "root"  // 超级管理员
	RoleAdmin = "admin" // 管理员
	RoleUser  = "user"  // 普通用户
)

// User 用户表
type User struct {
	Base
	Email        string `gorm:"uniqueIndex;not null" json:"email"`
	Name         string `gorm:"not null" json:"name"`
	PasswordHash string `gorm:"not null" json:"-"`
	// 不设 gorm default：避免 Create 时与默认值逻辑冲突导致未写入 role；由业务层或迁移统一赋值
	Role string `gorm:"size:32;not null;index" json:"role"`
}
