import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LayoutDashboard, Globe, Bot, Settings2, Link, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  path: string
  icon: React.ElementType
  labelKey: string
}

const navItems: NavItem[] = [
  { path: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { path: '/providers', icon: Globe, labelKey: 'nav.providers' },
  { path: '/user-agents', icon: Bot, labelKey: 'nav.userAgents' },
  { path: '/custom-configs', icon: Settings2, labelKey: 'nav.customConfigs' },
  { path: '/subscriptions', icon: Link, labelKey: 'nav.subscriptions' },
  { path: '/settings', icon: Settings, labelKey: 'nav.settings' },
]

interface SidebarProps {
  onNavClick?: () => void
}

export function Sidebar({ onNavClick }: SidebarProps) {
  const { t } = useTranslation()

  return (
    <nav className="flex flex-col gap-1 p-2">
      {navItems.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onNavClick}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{t(item.labelKey)}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
