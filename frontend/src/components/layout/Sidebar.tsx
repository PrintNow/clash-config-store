import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  Globe,
  Bot,
  Settings2,
  Link,
  Settings,
  FileCode2,
  BookOpen,
  Cloud,
  Users,
  ShieldCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuthStore } from '@/store/auth'

interface NavItem {
  path: string
  icon: React.ElementType
  labelKey: string
}

const navItems: NavItem[] = [
  { path: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
  { path: '/providers', icon: Globe, labelKey: 'nav.providers' },
  { path: '/custom-configs', icon: Settings2, labelKey: 'nav.customConfigs' },
  { path: '/config-templates', icon: FileCode2, labelKey: 'nav.configTemplates' },
  { path: '/rule-providers', icon: BookOpen, labelKey: 'nav.ruleProviders' },
  { path: '/hosted-rule-sets', icon: Cloud, labelKey: 'nav.hostedRuleSets' },
  { path: '/subscriptions', icon: Link, labelKey: 'nav.subscriptions' },
  { path: '/user-agents', icon: Bot, labelKey: 'nav.userAgents' },
  { path: '/settings', icon: Settings, labelKey: 'nav.settings' },
]

const adminNavItems: NavItem[] = [
  { path: '/admin/users', icon: Users, labelKey: 'nav.adminUsers' },
  { path: '/admin/settings', icon: ShieldCheck, labelKey: 'nav.adminSettings' },
]

interface SidebarProps {
  onNavClick?: () => void
  collapsed?: boolean
  labelsVisible?: boolean
}

export function Sidebar({ onNavClick, collapsed = false, labelsVisible = !collapsed }: SidebarProps) {
  const { t } = useTranslation()
  const role = useAuthStore((s) => s.user?.role)
  const showAdmin = role === 'root' || role === 'admin'

  const renderLink = (item: NavItem) => {
    const Icon = item.icon
    const label = t(item.labelKey)
    const link = (
      <NavLink
        key={item.path}
        to={item.path}
        onClick={onNavClick}
        aria-label={collapsed ? label : undefined}
        className={({ isActive }) =>
          cn(
            'flex items-center rounded-md text-sm font-medium transition-colors',
            collapsed ? 'h-10 w-10 justify-center' : 'gap-3 px-3 py-2.5',
            isActive
              ? 'bg-primary text-primary-foreground'
              : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
          )
        }
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span
          className={cn(
            'whitespace-nowrap transition-opacity duration-150',
            collapsed && 'sr-only',
            !collapsed && (labelsVisible ? 'opacity-100 delay-75' : 'opacity-0')
          )}
          aria-hidden={!collapsed && !labelsVisible}
        >
          {label}
        </span>
      </NavLink>
    )

    if (collapsed) {
      return (
        <Tooltip key={item.path}>
          <TooltipTrigger asChild>
            <div>{link}</div>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            {label}
          </TooltipContent>
        </Tooltip>
      )
    }

    return link
  }

  const navContent = (
    <nav className={cn('flex flex-col gap-1 p-2', collapsed && 'items-center')}>
      {navItems.map((item) => renderLink(item))}
      {showAdmin && (
        <>
          {!collapsed && labelsVisible && (
            <div className="text-muted-foreground px-3 pb-1 pt-3 text-xs font-medium">
              {t('nav.adminGroup')}
            </div>
          )}
          {adminNavItems.map((item) => renderLink(item))}
        </>
      )}
    </nav>
  )

  if (collapsed) {
    return (
      <TooltipProvider delayDuration={0} skipDelayDuration={0}>
        {navContent}
      </TooltipProvider>
    )
  }

  return navContent
}
