package util

import (
	"crypto/rand"
	"encoding/hex"
)

// GenerateSubscriptionToken 生成订阅用的随机 token（32字节hex = 64字符）
func GenerateSubscriptionToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
