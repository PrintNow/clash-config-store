# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> 详细架构与任务入口索引见 [AGENT.md](AGENT.md)。

## 常用命令

### 后端

```bash
go run ./cmd/server          # 开发启动（需 .env）
go test ./...                # 运行所有测试
go test ./internal/util/...  # 运行单个包的测试
make build                   # 生产构建（前端 → 后端二进制）
```

### 前端

```bash
cd frontend && npm run dev      # 开发服务器（含 /api、/sub、/ruleset 代理）
cd frontend && npm run build    # 类型检查 + 构建（验证变更首选）
cd frontend && npm run test     # 运行前端测试
```

### 配套工具

```bash
make geoip           # 下载 GeoLite2-City.mmdb 到 .docker/geoip/
make docker-build    # 下载 GeoIP 并构建 Docker 镜像
cp .env.example .env # 初次开发时复制并修改 JWT_SECRET
```

## 架构概览

**技术栈**：Go 1.25 + Gin + GORM（SQLite/MySQL）/ React + TypeScript + Vite + Tailwind + shadcn/ui  
**部署形态**：单容器，后端同时提供 REST API（`/api`）与前端静态资源

### 核心资源层级

```
Provider（上游订阅源）
  └── CustomConfig（proxies / proxy-groups / rules / 规则集引用）
        └── ConfigTemplate（顶层 mihomo YAML：端口/DNS/TUN）
              └── Subscription（绑定所有来源 → token → /sub/:token）
```

- `RuleProvider`：系统或用户外部规则集元数据（只被 CustomConfig 引用）
- `HostedRuleSet`：用户托管规则集，通过 `/ruleset/:token/:name` 公开下发
- `Subscription` 的 `EnabledProviderIDs` 以 JSON 文本字段存储

### 后端分层

| 层 | 职责 |
|---|---|
| `cmd/server/main.go` | 程序入口、路由注册 |
| `internal/handler` | 请求绑定、当前用户读取、响应封装（`handler.OK` / `handler.Fail`） |
| `internal/service` | 跨资源业务逻辑：订阅生成、Provider 拉取缓存 |
| `internal/model` | GORM 模型 |
| `internal/util/yaml.go` | Mihomo YAML 组装核心 |
| `internal/repository` | 数据库初始化与迁移 |

GORM 查询必须携带 `user_id` 过滤（内置预设资源除外）。

### 前端结构

| 目录 | 说明 |
|---|---|
| `frontend/src/pages` | 各领域页面 |
| `frontend/src/api` | API 模块（每个领域一个文件） |
| `frontend/src/components/layout` | `AppLayout`、`Sidebar`、`ContextSaveBar` |
| `frontend/src/i18n/locales` | `zh.ts` / `en.ts` 双语文案 |
| `frontend/src/store` | 全局状态（含 `context-save-bar.ts`） |

路由使用 `createBrowserRouter` + `RouterProvider`（非 `BrowserRouter`），支持 `useBlocker` 拦截未保存离开。

## 关键约定

- **ContextSaveBar**：需要「未保存 / 放弃 / 保存」顶栏时用 `ContextSaveBar` + `useRegisterContextSaveBar`，页面卸载时必须自动注销，额外操作走 `extraActions` 而非写死业务逻辑。
- **新增资源接口顺序**：`model` → `handler` → 必要时 `service` → `main.go` 路由注册。
- **新增前端页面顺序**：`pages` → `api` → `App.tsx` → `Sidebar.tsx` → i18n。
- **YAML 生成改动**：修改 `internal/util/yaml.go` 后必须补充或更新相关 Go 单测。
- **公开入口**：`/sub/:token` 和 `/ruleset/:token/:name` 不走登录态，改动要考虑 token 过期与访问限制兼容性。
- **跨实例导入**：`CustomConfig` 的 `rule_provider_ids` / `hosted_rule_set_ids` 是实例数据库主键，示例导入不要携带这些 ID。
