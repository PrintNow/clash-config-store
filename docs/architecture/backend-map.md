# 后端地图

本文档帮助 agent 快速定位后端资源、路由和业务逻辑。需要事实细节时，以源码为准。

## 全局入口

- 服务入口与路由注册：`cmd/server/main.go`
- 配置加载：`internal/config/config.go`
- 数据库初始化与种子数据：`internal/repository/db.go`
- 鉴权中间件：`internal/middleware/auth.go`
- 统一响应：`internal/handler/response.go`

## 资源映射

| 领域 | 模型 | Handler | Service | 路由 |
| --- | --- | --- | --- | --- |
| 用户认证 | `internal/model/user.go` | `internal/handler/auth.go` | `internal/service/auth.go` | `/api/auth/*` |
| 用户资料 | `internal/model/user.go` | `internal/handler/user.go` | - | `/api/user/*` |
| User-Agent | `internal/model/user_agent.go` | `internal/handler/user_agent.go` | - | `/api/user-agents` |
| 订阅源 | `internal/model/provider.go` | `internal/handler/provider.go` | `internal/service/provider.go` | `/api/providers` |
| 配置模板 | `internal/model/config_template.go` | `internal/handler/config_template.go` | - | `/api/config-templates` |
| 规则集库 | `internal/model/rule_provider.go` | `internal/handler/rule_provider.go` | - | `/api/rule-providers` |
| 托管规则集 | `internal/model/hosted_rule_set.go` | `internal/handler/hosted_rule_set.go` | - | `/api/hosted-rule-sets`、`/ruleset/:token/:name` |
| 自定义配置 | `internal/model/custom_config.go` | `internal/handler/custom_config.go` | - | `/api/custom-configs` |
| 订阅 | `internal/model/subscription.go` | `internal/handler/subscription.go`、`internal/handler/sub.go` | `internal/service/subscription.go` | `/api/subscriptions`、`/sub/:token` |
| 访问限制/日志 | `internal/model/access_restriction.go`、`internal/model/access_log.go` | `internal/handler/subscription.go` | `internal/service/subscription.go` | `/api/subscriptions/:id/*` |
| 仪表盘 | 多资源聚合 | `internal/handler/dashboard.go` | `internal/service/provider.go` | `/api/dashboard/*` |

## 分层约定

- Handler 负责请求绑定、当前用户读取、响应封装。
- Service 负责跨资源业务逻辑，例如订阅生成、Provider 拉取缓存。
- GORM 查询必须带 `user_id` 过滤，内置预设资源除外。
- 统一响应使用 `handler.OK`、`handler.Fail`、`handler.BindFail`。

## 高风险点

- `Subscription.EnabledProviderIDs` 是 JSON 文本字段，读写时要用统一解析逻辑。
- `CustomConfig` 导入导出的规则集 ID 与实例数据库绑定，跨实例示例不要依赖这些 ID。
- 公开入口 `/sub/:token` 和 `/ruleset/:token/:name` 不走登录态，改动时要考虑 token、访问限制与兼容性。
- YAML 生成逻辑跨 Provider、CustomConfig、ConfigTemplate、RuleProvider、HostedRuleSet，改动时优先补测试。

## 验证

后端改动默认运行：

```bash
go test ./...
```
