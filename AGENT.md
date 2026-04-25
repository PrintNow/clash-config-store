# Agent 协作约定（Clash Config Store）

## 项目定位

Clash Config Store 是一个面向 Mihomo/Clash 的订阅编排与分发平台：统一管理上游订阅源、规则集、自定义配置和订阅链接，最终生成可下发的完整 YAML。

核心用户流：

```text
Provider 订阅源 → CustomConfig / ConfigTemplate → Subscription → /sub/{token}
```

## 常见入口地图

- **前端路由**：[`frontend/src/App.tsx`](frontend/src/App.tsx)
- **侧栏导航**：[`frontend/src/components/layout/Sidebar.tsx`](frontend/src/components/layout/Sidebar.tsx)
- **页面目录**：[`frontend/src/pages`](frontend/src/pages)
- **前端 API 模块**：[`frontend/src/api`](frontend/src/api)
- **中英文文案**：[`frontend/src/i18n/locales/zh.ts`](frontend/src/i18n/locales/zh.ts)、[`frontend/src/i18n/locales/en.ts`](frontend/src/i18n/locales/en.ts)
- **后端路由注册**：[`cmd/server/main.go`](cmd/server/main.go)
- **后端模型**：[`internal/model`](internal/model)
- **后端处理器**：[`internal/handler`](internal/handler)
- **后端业务逻辑**：[`internal/service`](internal/service)
- **YAML 生成链路**：[`internal/service/subscription.go`](internal/service/subscription.go)、[`internal/util/yaml.go`](internal/util/yaml.go)

## 高频任务从哪里开始

- **改管理页或空状态**：先看目标页面的 `frontend/src/pages/*.tsx`，再补 `frontend/src/i18n/locales/*.ts`。
- **新增前端页面**：按 `frontend/src/pages`、`frontend/src/api`、`frontend/src/App.tsx`、`frontend/src/components/layout/Sidebar.tsx`、i18n 的顺序处理。
- **新增后端资源接口**：按 `internal/model`、`internal/handler`、必要时 `internal/service`、`cmd/server/main.go` 的顺序处理。
- **改订阅生成结果**：先读 `internal/service/subscription.go` 和 `internal/util/yaml.go`，再补或更新相关 Go 测试。
- **改自定义配置导入/导出**：优先看 `internal/handler/custom_config.go` 与 `frontend/src/api/custom-configs.ts`。
- **改订阅详情流程**：同时检查 `frontend/src/pages/SubscriptionDetail.tsx`、`frontend/src/api/subscriptions.ts`、`internal/handler/subscription.go`。

## 验证命令

- 前端类型与构建：`cd frontend && npm run build`
- 后端测试：`go test ./...`
- YAML 生成或订阅下发相关改动：优先补充并运行相关 Go 单测。

## 高风险提醒

- `CustomConfig` 的 `rule_provider_ids` / `hosted_rule_set_ids` 依赖当前实例数据库主键，跨实例示例导入不要直接携带这些 ID。
- `Subscription.EnabledProviderIDs` 在后端以 JSON 文本存储，更新时注意序列化与反序列化逻辑。
- `GET /sub/:token` 是公开下发入口，受 token 过期与访问限制影响；改动时避免破坏公开订阅兼容性。
- `ConfigTemplate` 只负责顶层 mihomo 配置，`proxies` / `proxy-groups` / `rules` 应主要由 `CustomConfig` 管理。

## 详细索引

- 领域文件映射见 [`docs/project-index.yaml`](docs/project-index.yaml)。
- 前端页面地图见 [`docs/architecture/frontend-map.md`](docs/architecture/frontend-map.md)。
- 后端资源地图见 [`docs/architecture/backend-map.md`](docs/architecture/backend-map.md)。
- 订阅生成数据流见 [`docs/architecture/data-flow.md`](docs/architecture/data-flow.md)。

## 代码约定

- **UI 组件**：页面级布局、按钮、表单控件等优先使用 Shadcn UI（`frontend/src/components/ui/`），保持与现有 Tailwind 主题一致。
- **全局顶栏保存条（Context Save Bar）**：需要「未保存 + 放弃 + 保存」且不应占用 [`AppLayout`](frontend/src/components/layout/AppLayout.tsx) 右侧语言/主题/用户区域时，使用 [`ContextSaveBar`](frontend/src/components/layout/ContextSaveBar.tsx) + [`useRegisterContextSaveBar`](frontend/src/store/context-save-bar.ts)；页面卸载或 `enabled: false` 时必须自动注销，避免污染其他路由。扩展操作通过注册项里的 `extraActions`（显示在「放弃」左侧），勿在 [`ContextSaveBar.tsx`](frontend/src/components/layout/ContextSaveBar.tsx) 内写死业务逻辑。
- **路由与 `useBlocker`**：应用入口使用 [`createBrowserRouter` + `RouterProvider`](frontend/src/App.tsx)（非 `BrowserRouter`），以便在需要时用 React Router 的 `useBlocker` 拦截未保存离开。
- **注册方互斥**：同一时间仅保留一个保存条注册方；多页面同时注册时以后注册者为准，新增场景前先评估是否改用局部 UI。
