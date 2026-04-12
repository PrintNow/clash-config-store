package main

import (
	"log/slog"
	"os"
	"time"

	"clash-config-store/internal/applog"
	"clash-config-store/internal/config"
	"clash-config-store/internal/handler"
	"clash-config-store/internal/middleware"
	"clash-config-store/internal/repository"
	"clash-config-store/internal/util"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	applog.Init()
	cfg := config.Load()

	if err := util.InitGeoIP(cfg.GeoIPPath); err != nil {
		slog.Warn("GeoIP 初始化失败", slog.String("component", "main"), slog.Any("err", err))
	}
	defer util.CloseGeoIP()

	if err := repository.Init(cfg); err != nil {
		slog.Error("数据库初始化失败", slog.String("component", "main"), slog.Any("err", err))
		os.Exit(1)
	}

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowAllOrigins:  true,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Subscription-Userinfo"},
		AllowCredentials: false,
		MaxAge:           12 * time.Hour,
	}))

	// 公开路由：订阅下发，无需认证
	r.GET("/sub/:token", handler.HandleSub)

	api := r.Group("/api")
	{
		auth := api.Group("/auth")
		auth.POST("/register", handler.Register)
		auth.POST("/login", handler.Login)

		protected := api.Group("", middleware.Auth())
		{
			// 用户信息
			user := protected.Group("/user")
			user.GET("/profile", handler.GetProfile)
			user.PUT("/profile", handler.UpdateProfile)
			user.PUT("/password", handler.UpdatePassword)

			// 仪表盘
			protected.GET("/dashboard/stats", handler.GetDashboardStats)
			protected.POST("/dashboard/refresh-all-providers", handler.RefreshAllProviders)

			// User-Agent 管理
			ua := protected.Group("/user-agents")
			ua.GET("", handler.ListUserAgents)
			ua.POST("", handler.CreateUserAgent)
			ua.PUT("/:id", handler.UpdateUserAgent)
			ua.DELETE("/:id", handler.DeleteUserAgent)

			// 上游订阅源管理
			prov := protected.Group("/providers")
			prov.GET("", handler.ListProviders)
			prov.POST("", handler.CreateProvider)
			prov.PUT("/:id", handler.UpdateProvider)
			prov.DELETE("/:id", handler.DeleteProvider)
			prov.POST("/:id/refresh", handler.RefreshProvider)

			// 配置模板管理
			ct := protected.Group("/config-templates")
			ct.GET("", handler.ListConfigTemplates)
			ct.POST("", handler.CreateConfigTemplate)
			ct.GET("/:id", handler.GetConfigTemplate)
			ct.PUT("/:id", handler.UpdateConfigTemplate)
			ct.DELETE("/:id", handler.DeleteConfigTemplate)

			// 规则集库管理
			rp := protected.Group("/rule-providers")
			rp.GET("", handler.ListRuleProviders)
			rp.POST("", handler.CreateRuleProvider)
			rp.GET("/:id", handler.GetRuleProvider)
			rp.PUT("/:id", handler.UpdateRuleProvider)
			rp.DELETE("/:id", handler.DeleteRuleProvider)

			// 自定义配置管理
			cc := protected.Group("/custom-configs")
			cc.GET("", handler.ListCustomConfigs)
			cc.POST("", handler.CreateCustomConfig)
			cc.POST("/import", handler.ImportCustomConfig)
			cc.GET("/:id", handler.GetCustomConfig)
			cc.PUT("/:id", handler.UpdateCustomConfig)
			cc.DELETE("/:id", handler.DeleteCustomConfig)
			cc.POST("/:id/clone", handler.CloneCustomConfig)
			cc.GET("/:id/export", handler.ExportCustomConfig)
			cc.GET("/:id/preview", handler.PreviewCustomConfig)

			// 订阅管理
			sub := protected.Group("/subscriptions")
			sub.GET("", handler.ListSubscriptions)
			sub.POST("", handler.CreateSubscription)
			sub.GET("/:id", handler.GetSubscription)
			sub.PUT("/:id", handler.UpdateSubscription)
			sub.DELETE("/:id", handler.DeleteSubscription)
			sub.POST("/:id/regenerate-token", handler.RegenerateToken)
			sub.GET("/:id/access-logs", handler.GetAccessLogs)
			sub.GET("/:id/restrictions", handler.ListRestrictions)
			sub.POST("/:id/restrictions", handler.CreateRestriction)
			sub.DELETE("/:id/restrictions/:rid", handler.DeleteRestriction)
		}
	}

	slog.Info("服务启动", slog.String("component", "main"), slog.String("addr", ":"+cfg.Port))
	if err := r.Run(":" + cfg.Port); err != nil {
		slog.Error("服务启动失败", slog.String("component", "main"), slog.Any("err", err))
		os.Exit(1)
	}
}
