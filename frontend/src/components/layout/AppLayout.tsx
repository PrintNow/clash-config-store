import { useState, useEffect } from 'react'
import { Outlet, Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  Menu,
  X,
  Sun,
  Moon,
  Monitor,
  Languages,
  LogOut,
  User,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/auth'
import { useThemeStore } from '@/store/theme'
import { userApi } from '@/api/user'
import { Sidebar } from './Sidebar'
import { SidebarBrand } from './SidebarBrand'
import { SidebarFooter } from './SidebarFooter'
import { ContextSaveBar } from './ContextSaveBar'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

const SIDEBAR_COLLAPSED_KEY = 'sidebarCollapsed'
const SIDEBAR_TRANSITION_MS = 50

export function AppLayout() {
  const { user, token, logout, setAuth } = useAuthStore()
  const { theme, setTheme } = useThemeStore()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true'
  )
  const [sidebarLabelsVisible, setSidebarLabelsVisible] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) !== 'true'
  )

  // 初始化时从 localStorage 恢复认证信息
  useEffect(() => {
    useAuthStore.getState().initFromStorage()
  }, [])

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed))
  }, [sidebarCollapsed])

  useEffect(() => {
    if (sidebarCollapsed) {
      setSidebarLabelsVisible(false)
      return
    }

    const timer = window.setTimeout(() => {
      setSidebarLabelsVisible(true)
    }, SIDEBAR_TRANSITION_MS)

    return () => window.clearTimeout(timer)
  }, [sidebarCollapsed])

  // 挂载时从服务端拉取最新用户信息，同步到 store
  useQuery({
    queryKey: ['user-profile-sync'],
    queryFn: async () => {
      const freshUser = await userApi.getProfile()
      const currentToken = localStorage.getItem('token')
      if (currentToken) {
        setAuth(currentToken, freshUser)
      }
      return freshUser
    },
    enabled: !!token || !!localStorage.getItem('token'),
    // 静默刷新，窗口获得焦点时也重新拉取
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  })

  // 未登录重定向到登录页
  if (!token && !localStorage.getItem('token')) {
    return <Navigate to="/login" replace />
  }

  const handleLogout = () => {
    logout()
    toast.success(t('auth.logoutSuccess'))
    navigate('/login')
  }

  const toggleLanguage = () => {
    const newLang = i18n.language === 'zh' ? 'en' : 'zh'
    i18n.changeLanguage(newLang)
    localStorage.setItem('language', newLang)
  }

  // 用户名首字母作为头像 fallback
  const avatarFallback = user?.name?.charAt(0).toUpperCase() || 'U'

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* 桌面端固定侧边栏 */}
      <aside
        className={cn(
          'hidden flex-col border-r bg-sidebar transition-[width] duration-200 md:flex',
          sidebarCollapsed ? 'w-16' : 'w-60'
        )}
      >
        <div
          className={cn(
            'flex h-16 shrink-0 items-center border-b border-sidebar-border px-3',
            sidebarCollapsed ? 'justify-center px-2' : 'gap-2'
          )}
        >
          <SidebarBrand
            className={cn('min-w-0', sidebarCollapsed ? 'flex-none' : 'flex-1')}
            collapsed={sidebarCollapsed}
            labelsVisible={sidebarLabelsVisible}
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <div
            className={cn(
              'flex-1 overflow-y-auto py-2 transition-colors',
              sidebarCollapsed && 'cursor-e-resize hover:bg-sidebar-accent/20'
            )}
            title={sidebarCollapsed ? t('layout.expandSidebar') : undefined}
            onClick={(event) => {
              if (!sidebarCollapsed) return
              const target = event.target as HTMLElement
              if (target.closest('a, button')) return
              setSidebarCollapsed(false)
            }}
          >
            <Sidebar collapsed={sidebarCollapsed} labelsVisible={sidebarLabelsVisible} />
          </div>
          <SidebarFooter
            collapsed={sidebarCollapsed}
            labelsVisible={sidebarLabelsVisible}
            onToggleCollapse={() => setSidebarCollapsed((collapsed) => !collapsed)}
          />
        </div>
      </aside>

      {/* 移动端侧边栏遮罩 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* 移动端侧边栏抽屉 */}
      <aside
        className={`fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r bg-sidebar transition-transform duration-200 md:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between gap-2 border-b border-sidebar-border px-3">
          <SidebarBrand
            className="min-w-0 flex-1"
            onNavigate={() => setSidebarOpen(false)}
          />
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)} aria-label={t('common.close')}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex-1 overflow-y-auto py-2">
            <Sidebar onNavClick={() => setSidebarOpen(false)} />
          </div>
          <SidebarFooter />
        </div>
      </aside>

      {/* 右侧主内容区 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 顶部导航栏 */}
        <header className="flex h-16 items-center border-b bg-background px-4 gap-2">
          <div className="flex min-w-0 flex-1 items-center justify-start">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>

          <div className="flex shrink-0 justify-center px-2">
            <ContextSaveBar />
          </div>

          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            {/* 语言切换 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleLanguage}
              title={t('language.toggle')}
            >
              <Languages className="h-4 w-4" />
            </Button>

            {/* 主题切换 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" title={t('theme.toggle')}>
                  {theme === 'light' ? (
                    <Sun className="h-4 w-4" />
                  ) : theme === 'dark' ? (
                    <Moon className="h-4 w-4" />
                  ) : (
                    <Monitor className="h-4 w-4" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme('light')}>
                  <Sun className="mr-2 h-4 w-4" />
                  {t('theme.light')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('dark')}>
                  <Moon className="mr-2 h-4 w-4" />
                  {t('theme.dark')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme('system')}>
                  <Monitor className="mr-2 h-4 w-4" />
                  {t('theme.system')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 用户菜单 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {avatarFallback}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/settings')}>
                  <User className="mr-2 h-4 w-4" />
                  {t('nav.settings')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  {t('nav.logout')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* 页面内容 */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
