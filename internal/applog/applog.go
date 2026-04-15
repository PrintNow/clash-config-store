// Package applog 统一初始化 slog，供 HTTP、GORM 与业务日志共用格式
package applog

import (
	"log/slog"
	"os"
	"time"

	gormlogger "gorm.io/gorm/logger"
)

// Init 配置全局 slog：行格式与 Gin 默认 Logger 对齐（时间 2006/01/02 - 15:04:05、同类 ANSI 色块）；NO_COLOR / 非 TTY 时不着色
func Init() {
	h := newGinStyleHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})
	slog.SetDefault(slog.New(h))
}

// GormLogger 返回与全局 slog 一致的 GORM 日志器（忽略 First 未找到行，避免刷屏）
func GormLogger() gormlogger.Interface {
	return gormlogger.NewSlogLogger(slog.Default(), gormlogger.Config{
		LogLevel:                  gormlogger.Warn,
		SlowThreshold:             200 * time.Millisecond,
		IgnoreRecordNotFoundError: true,
		Colorful:                  false,
	})
}
