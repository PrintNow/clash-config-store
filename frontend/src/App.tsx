import { createBrowserRouter, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Login } from '@/pages/Login'
import { Register } from '@/pages/Register'
import { Dashboard } from '@/pages/Dashboard'
import { Providers } from '@/pages/Providers'
import { UserAgents } from '@/pages/UserAgents'
import { CustomConfigs } from '@/pages/CustomConfigs'
import { CustomConfigDetail } from '@/pages/CustomConfigDetail'
import { ConfigTemplates } from '@/pages/ConfigTemplates'
import { ConfigTemplateDetail } from '@/pages/ConfigTemplateDetail'
import { RuleProviders } from '@/pages/RuleProviders'
import { HostedRuleSets } from '@/pages/HostedRuleSets'
import { Subscriptions } from '@/pages/Subscriptions'
import { SubscriptionDetail } from '@/pages/SubscriptionDetail'
import { AccessLogs } from '@/pages/AccessLogs'
import { Settings } from '@/pages/Settings'
import { AdminUsers } from '@/pages/admin/AdminUsers'
import { AdminSettings } from '@/pages/admin/AdminSettings'

/** 数据路由（支持 useBlocker 等 API） */
export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'providers', element: <Providers /> },
      { path: 'user-agents', element: <UserAgents /> },
      { path: 'custom-configs', element: <CustomConfigs /> },
      { path: 'custom-configs/:id', element: <CustomConfigDetail /> },
      { path: 'config-templates', element: <ConfigTemplates /> },
      { path: 'config-templates/:id', element: <ConfigTemplateDetail /> },
      { path: 'rule-providers', element: <RuleProviders /> },
      { path: 'hosted-rule-sets', element: <HostedRuleSets /> },
      { path: 'subscriptions', element: <Subscriptions /> },
      { path: 'subscriptions/:id', element: <SubscriptionDetail /> },
      { path: 'subscriptions/:id/logs', element: <AccessLogs /> },
      { path: 'settings', element: <Settings /> },
      { path: 'admin/users', element: <AdminUsers /> },
      { path: 'admin/settings', element: <AdminSettings /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
