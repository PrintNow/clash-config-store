package util

import (
	"strings"

	"clash-config-store/internal/config"
)

func RuleSetPublicURL(token string) string {
	base := strings.TrimRight(config.App.BaseURL, "/")
	return base + "/ruleset/" + token
}

