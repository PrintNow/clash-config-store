import { useState, useEffect } from 'react'
import { Link, Outlet, Navigate, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Menu, X, Sun, Moon, Monitor, Languages, LogOut, User } from 'lucide-react'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/auth'
import { useThemeStore } from '@/store/theme'
import { Sidebar } from './Sidebar'
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

export function AppLayout() {
  const { user, token, logout } = useAuthStore()
  const { theme, setTheme } = useThemeStore()
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // 初始化时从 localStorage 恢复认证信息
  useEffect(() => {
    useAuthStore.getState().initFromStorage()
  }, [])

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
      <aside className="hidden md:flex w-60 flex-col border-r bg-sidebar">
        <div className="flex h-16 items-center px-4 border-b border-sidebar-border">
          <Link
            to="/dashboard"
            className="text-lg font-bold text-sidebar-foreground hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring rounded-sm transition-colors"
          >
            Clash Config Store
          </Link>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <Sidebar />
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
        <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
          <Link
            to="/dashboard"
            onClick={() => setSidebarOpen(false)}
            className="text-lg font-bold text-sidebar-foreground hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring rounded-sm transition-colors truncate pr-2"
          >
            Clash Config Store
          </Link>
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          <Sidebar onNavClick={() => setSidebarOpen(false)} />
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
