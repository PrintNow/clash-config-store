import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { App } from './App'
import { useAuthStore } from './store/auth'
import './i18n'
import './index.css'

// 初始化 TanStack Query 客户端
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30 * 1000,
    },
  },
})

// 应用启动时从 localStorage 恢复认证信息
useAuthStore.getState().initFromStorage()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        {/* 全局 Toast 通知 */}
        <Toaster
          position="top-right"
          richColors
          closeButton
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
