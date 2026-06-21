package util

import (
	"strings"

	"gopkg.in/yaml.v3"
)

// CountRules 解析规则集内容并返回规则数量。
// yaml 格式解析 payload 列表；其他格式按行计数（排除空行和注释）。
func CountRules(content, format string) int {
	if strings.TrimSpace(content) == "" {
		return 0
	}
	if format == "yaml" {
		var doc struct {
			Payload []string `yaml:"payload"`
		}
		if err := yaml.Unmarshal([]byte(content), &doc); err == nil && len(doc.Payload) > 0 {
			return len(doc.Payload)
		}
	}
	count := 0
	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(line)
		if line != "" && !strings.HasPrefix(line, "#") {
			count++
		}
	}
	return count
}
