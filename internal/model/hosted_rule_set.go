package model

type HostedRuleSet struct {
	Base
	UserID        uint   `gorm:"uniqueIndex:idx_hosted_rule_sets_user_name;index;not null" json:"user_id"`
	Name          string `gorm:"uniqueIndex:idx_hosted_rule_sets_user_name;not null" json:"name"`
	Behavior      string `gorm:"not null;default:'domain'" json:"behavior"`
	Format        string `gorm:"not null;default:'yaml'" json:"format"`
	Content       string `gorm:"type:longtext;not null" json:"content"`
	ContentSHA256 string `gorm:"type:char(64);not null;default:''" json:"content_sha256"`
	Token         string `gorm:"type:char(64);uniqueIndex" json:"token"`
	RuleCount     int    `gorm:"default:0" json:"rule_count"`

	URL string `gorm:"-" json:"url"`

	User User `gorm:"foreignKey:UserID" json:"-"`
}
