package config

import (
	"log/slog"
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
		slog.Info("未找到 .env 文件，使用环境变量", slog.String("component", "config"))
	}

	App = &Config{
		Port:      getEnv("APP_PORT", "26406"),
		DBType:    getEnv("DB_TYPE", "sqlite"),
		DBDsn:     getEnv("DB_DSN", "clash-config-store.db"),
		JWTSecret: getEnv("JWT_SECRET", "please-change-this-secret-in-production"),
		JWTExpiry: getEnvInt("JWT_EXPIRY_HOURS", 24),
		GeoIPPath: resolveGeoIPPath(),
		BaseURL:   getEnv("BASE_URL", "http://localhost:26406"),
	}
	return App
}

func resolveGeoIPPath() string {
	if v := os.Getenv("GEOIP_PATH"); v != "" {
		return v
	}
	defaultPath := "/data/clash-config-store.d/GeoLite2-City.mmdb"
	if _, err := os.Stat(defaultPath); err == nil {
		return defaultPath
	}
	// 本地开发通常不存在该文件，回退为空表示禁用 GeoIP。
	return ""
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
