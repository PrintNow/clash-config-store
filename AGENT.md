# Agent 协作约定（Clash Config Store）

- **UI 组件**：页面级布局、按钮、表单控件等优先使用 Shadcn UI（`frontend/src/components/ui/`），保持与现有 Tailwind 主题一致。
- **全局顶栏保存条（Context Save Bar）**：需要「未保存 + 放弃 + 保存」且不应占用 [`AppLayout`](frontend/src/components/layout/AppLayout.tsx) 右侧语言/主题/用户区域时，使用 [`ContextSaveBar`](frontend/src/components/layout/ContextSaveBar.tsx) + [`useRegisterContextSaveBar`](frontend/src/store/context-save-bar.ts)；页面卸载或 `enabled: false` 时必须自动注销，避免污染其他路由。扩展操作通过注册项里的 `extraActions`（显示在「放弃」左侧），勿在 [`ContextSaveBar.tsx`](frontend/src/components/layout/ContextSaveBar.tsx) 内写死业务逻辑。
- **路由与 `useBlocker`**：应用入口使用 [`createBrowserRouter` + `RouterProvider`](frontend/src/App.tsx)（非 `BrowserRouter`），以便在需要时用 React Router 的 `useBlocker` 拦截未保存离开。
- **注册方互斥**：同一时间仅保留一个保存条注册方；多页面同时注册时以后注册者为准，新增场景前先评估是否改用局部 UI。
