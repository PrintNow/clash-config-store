package model

// User 用户表
type User struct {
	Base
	Email        string `gorm:"uniqueIndex;not null" json:"email"`
	Name         string `gorm:"not null" json:"name"`
	PasswordHash string `gorm:"not null" json:"-"`
	IsAdmin      bool   `gorm:"not null;default:false" json:"is_admin"`
}
