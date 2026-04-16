package model

type HostedRuleSet struct {
	Base
	UserID        uint   `gorm:"index;not null" json:"user_id"`
	Name          string `gorm:"not null" json:"name"`
	Behavior      string `gorm:"not null;default:'domain'" json:"behavior"`
	Format        string `gorm:"not null;default:'yaml'" json:"format"`
	Content       string `gorm:"type:longtext;not null" json:"content"`
	ContentSHA256 string `gorm:"type:char(64);not null;default:''" json:"content_sha256"`
	ShareEnabled  bool   `gorm:"not null;default:false" json:"share_enabled"`
	ShareToken    *string `gorm:"type:char(64);uniqueIndex" json:"share_token"`

	ShareURL string `gorm:"-" json:"share_url"`

	User User `gorm:"foreignKey:UserID" json:"-"`
}
