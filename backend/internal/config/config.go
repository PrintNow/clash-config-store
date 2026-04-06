package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port string

	DBType string // "sqlite" 或 "mysql"
	DBDsn  string // SQLite 文件路径 或 MySQL DSN

	JWTSecret string
	JWTExpiry int // token 有效期（小时）

	GeoIPPath string // MaxMind GeoLite2 .mmdb 文件路径

	BaseURL string // 服务对外访问的基础 URL，用于生成订阅链接
}

var App *Config

func Load() *Config {
	// 尝试加载 .env 文件，不存在则忽略
	if err := godotenv.Load(); err != nil {
		log.Println("[config] 未找到 .env 文件，使用环境变量")
	}

	App = &Config{
		Port:      getEnv("PORT", "8080"),
		DBType:    getEnv("DB_TYPE", "sqlite"),
		DBDsn:     getEnv("DB_DSN", "clash-config-store.db"),
		JWTSecret: getEnv("JWT_SECRET", "please-change-this-secret-in-production"),
		JWTExpiry: getEnvInt("JWT_EXPIRY_HOURS", 24),
		GeoIPPath: getEnv("GEOIP_PATH", ""),
		BaseURL:   getEnv("BASE_URL", "http://localhost:8080"),
	}
	return App
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return fallback
}
