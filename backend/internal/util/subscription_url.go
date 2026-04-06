package util

import (
	"strings"

	"clash-config-store/internal/config"
)

// SubscriptionPublicURL 使用服务对外 BASE_URL 拼接订阅拉取地址
func SubscriptionPublicURL(token string) string {
	base := strings.TrimRight(config.App.BaseURL, "/")
	return base + "/sub/" + token
}
