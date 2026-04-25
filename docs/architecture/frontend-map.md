# 前端地图

本文档帮助 agent 快速定位前端改动入口。需要事实细节时，以源码为准。

## 全局入口

- 路由注册：`frontend/src/App.tsx`
- 应用挂载：`frontend/src/main.tsx`
- 认证与主布局：`frontend/src/components/layout/AppLayout.tsx`
- 侧栏导航：`frontend/src/components/layout/Sidebar.tsx`
- 中英文文案：`frontend/src/i18n/locales/zh.ts`、`frontend/src/i18n/locales/en.ts`
- API 客户端：`frontend/src/api/client.ts`

## 领域页面

| 领域 | 页面 | API 模块 | 说明 |
| --- | --- | --- | --- |
| 仪表盘 | `frontend/src/pages/Dashboard.tsx` | `frontend/src/api/dashboard.ts` | 统计、订阅源状态、订阅健康、最近访问日志 |
| 订阅源 | `frontend/src/pages/Providers.tsx` | `frontend/src/api/providers.ts` | 上游订阅 URL、缓存刷新、可选 User-Agent |
| User-Agent | `frontend/src/pages/UserAgents.tsx` | `frontend/src/api/user-agents.ts` | 可复用 UA 字符串 |
| 自定义配置 | `frontend/src/pages/CustomConfigs.tsx`、`frontend/src/pages/CustomConfigDetail.tsx` | `frontend/src/api/custom-configs.ts` | 代理节点、代理组、规则、规则集引用、导入导出 |
| 配置模板 | `frontend/src/pages/ConfigTemplates.tsx`、`frontend/src/pages/ConfigTemplateDetail.tsx` | `frontend/src/api/config-templates.ts` | 顶层 mihomo YAML 片段 |
| 规则集库 | `frontend/src/pages/RuleProviders.tsx` | `frontend/src/api/rule-providers.ts` | 内置和外部 rule-providers |
| 托管规则集 | `frontend/src/pages/HostedRuleSets.tsx` | `frontend/src/api/hosted-rule-sets.ts` | 用户自托管规则内容与公开访问链接 |
| 订阅管理 | `frontend/src/pages/Subscriptions.tsx`、`frontend/src/pages/SubscriptionDetail.tsx` | `frontend/src/api/subscriptions.ts` | 创建订阅、绑定来源与配置、复制链接、访问限制 |
| 访问日志 | `frontend/src/pages/AccessLogs.tsx` | `frontend/src/api/subscriptions.ts` | 查看订阅访问记录 |
| 设置 | `frontend/src/pages/Settings.tsx` | `frontend/src/api/user.ts` | 用户资料与密码 |

## 常见改动路径

- 改页面文案或空状态：页面组件 + `frontend/src/i18n/locales/zh.ts` + `frontend/src/i18n/locales/en.ts`。
- 改列表数据：页面组件 + 对应 `frontend/src/api/*.ts` + 后端 handler。
- 改订阅链接展示：优先看 `frontend/src/lib/subscription-url.ts` 和订阅相关页面。
- 改复杂配置编辑器：优先看 `frontend/src/pages/CustomConfigDetail.tsx`，注意该页使用 `useBlocker` 和 `ContextSaveBar`。

## 验证

前端改动默认运行：

```bash
cd frontend && npm run build
```
