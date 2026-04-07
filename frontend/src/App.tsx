import { Routes, Route, Navigate } from 'react-router-dom'
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
import { Subscriptions } from '@/pages/Subscriptions'
import { SubscriptionDetail } from '@/pages/SubscriptionDetail'
import { AccessLogs } from '@/pages/AccessLogs'
import { Settings } from '@/pages/Settings'

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="providers" element={<Providers />} />
        <Route path="user-agents" element={<UserAgents />} />
        <Route path="custom-configs" element={<CustomConfigs />} />
        <Route path="custom-configs/:id" element={<CustomConfigDetail />} />
        <Route path="config-templates" element={<ConfigTemplates />} />
        <Route path="config-templates/:id" element={<ConfigTemplateDetail />} />
        <Route path="rule-providers" element={<RuleProviders />} />
        <Route path="subscriptions" element={<Subscriptions />} />
        <Route path="subscriptions/:id" element={<SubscriptionDetail />} />
        <Route path="subscriptions/:id/logs" element={<AccessLogs />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
