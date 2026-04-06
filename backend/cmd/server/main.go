package main

import (
	"log"
	"time"

	"clash-config-store/internal/config"
	"clash-config-store/internal/handler"
	"clash-config-store/internal/middleware"
	"clash-config-store/internal/repository"
	"clash-config-store/internal/util"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	// 初始化 GeoIP 数据库（可选，路径为空时跳过）
	if err := util.InitGeoIP(cfg.GeoIPPath); err != nil {
		log.Printf("[main] GeoIP 初始化失败: %v", err)
	}
	defer util.CloseGeoIP()

	// 初始化数据库并自动迁移
	if err := repository.Init(cfg); err != nil {
		log.Fatalf("[main] 数据库初始化失败: %v", err)
	}

	r := gin.Default()

	// CORS 配置（开发模式下允许所有来源，生产环境请按需收紧）
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

	// API 路由组
	api := r.Group("/api")
	{
		// 认证相关（无需 JWT）
		auth := api.Group("/auth")
		auth.POST("/register", handler.Register)
		auth.POST("/login", handler.Login)

		// 需要 JWT 认证的路由
		protected := api.Group("", middleware.Auth())
		{
			// 用户信息
			user := protected.Group("/user")
			user.GET("/profile", handler.GetProfile)
			user.PUT("/profile", handler.UpdateProfile)
			user.PUT("/password", handler.UpdatePassword)

			// 仪表板
			protected.GET("/dashboard/stats", handler.GetDashboardStats)

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

			// 自定义配置管理
			cc := protected.Group("/custom-configs")
			cc.GET("", handler.ListCustomConfigs)
			cc.POST("", handler.CreateCustomConfig)
			cc.GET("/:id", handler.GetCustomConfig)
			cc.PUT("/:id", handler.UpdateCustomConfig)
			cc.DELETE("/:id", handler.DeleteCustomConfig)

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

	log.Printf("[main] 服务启动，监听端口 %s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("[main] 服务启动失败: %v", err)
	}
}
