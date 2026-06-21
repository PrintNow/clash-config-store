package util

import (
	"net/url"
	"strings"

	"clash-config-store/internal/config"
)

func RuleSetPublicURL(token string, name string) string {
	base := strings.TrimRight(config.App.BaseURL, "/")
	return base + "/ruleset/" + token + "/" + url.PathEscape(name)
}

func RuleProviderCacheURL(token string) string {
	base := strings.TrimRight(config.App.BaseURL, "/")
	return base + "/rule-cache/" + token
}
