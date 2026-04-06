import { Routes, Route, Navigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { Login } from '@/pages/Login'
import { Register } from '@/pages/Register'
import { Dashboard } from '@/pages/Dashboard'
import { Providers } from '@/pages/Providers'
import { UserAgents } from '@/pages/UserAgents'
import { CustomConfigs } from '@/pages/CustomConfigs'
import { CustomConfigDetail } from '@/pages/CustomConfigDetail'
import { Subscriptions } from '@/pages/Subscriptions'
import { SubscriptionDetail } from '@/pages/SubscriptionDetail'
import { AccessLogs } from '@/pages/AccessLogs'
import { Settings } from '@/pages/Settings'

export function App() {
  return (
    <Routes>
      {/* 公开路由 */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* 需要认证的路由 */}
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="providers" element={<Providers />} />
        <Route path="user-agents" element={<UserAgents />} />
        <Route path="custom-configs" element={<CustomConfigs />} />
        <Route path="custom-configs/:id" element={<CustomConfigDetail />} />
        <Route path="subscriptions" element={<Subscriptions />} />
        <Route path="subscriptions/:id" element={<SubscriptionDetail />} />
        <Route path="subscriptions/:id/logs" element={<AccessLogs />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* 未匹配路由重定向到首页 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
