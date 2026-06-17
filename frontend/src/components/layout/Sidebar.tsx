import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LayoutDashboard, Globe, Bot, Settings2, Link, Settings, FileCode2, BookOpen, ShieldCheck, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuthStore } from '@/store/auth'

interface NavItem {
  path: string
  icon: React.ElementType
  labelKey: string
}

interface NavGroup {
  label?: string
  labelKey?: string
  items: NavItem[]
  adminOnly?: boolean
}

const navGroups: NavGroup[] = [
  {
    items: [
      { path: '/dashboard', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
    ],
  },
  {
    labelKey: 'nav.groupSource',
    items: [
      { path: '/providers', icon: Globe, labelKey: 'nav.providers' },
      { path: '/rule-sets', icon: BookOpen, labelKey: 'nav.ruleSets' },
    ],
  },
  {
    labelKey: 'nav.groupOrchestration',
    items: [
      { path: '/custom-configs', icon: Settings2, labelKey: 'nav.customConfigs' },
      { path: '/config-templates', icon: FileCode2, labelKey: 'nav.configTemplates' },
    ],
  },
  {
    labelKey: 'nav.groupPublish',
    items: [
      { path: '/subscriptions', icon: Link, labelKey: 'nav.subscriptions' },
    ],
  },
  {
    items: [
      { path: '/user-agents', icon: Bot, labelKey: 'nav.userAgents' },
      { path: '/settings', icon: Settings, labelKey: 'nav.settings' },
    ],
  },
  {
    labelKey: 'nav.groupAdmin',
    adminOnly: true,
    items: [
      { path: '/admin/users', icon: Users, labelKey: 'nav.adminUsers' },
      { path: '/admin/settings', icon: ShieldCheck, labelKey: 'nav.adminSettings' },
    ],
  },
]

interface SidebarProps {
  onNavClick?: () => void
  collapsed?: boolean
  labelsVisible?: boolean
}

export function Sidebar({ onNavClick, collapsed = false, labelsVisible = !collapsed }: SidebarProps) {
  const { t } = useTranslation()
  const { user } = useAuthStore()

  const renderNavItem = (item: NavItem) => {
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

  const visibleGroups = navGroups.filter((g) => !g.adminOnly || user?.is_admin)

  const navContent = (
    <nav className={cn('flex flex-col gap-1 p-2', collapsed && 'items-center')}>
      {visibleGroups.map((group, groupIdx) => (
        <div key={groupIdx} className={cn('flex flex-col gap-1', groupIdx > 0 && 'mt-1')}>
          {!collapsed && group.labelKey && (
            <div className="px-2 py-1 text-xs text-muted-foreground font-medium">
              {t(group.labelKey)}
            </div>
          )}
          {group.items.map(renderNavItem)}
        </div>
      ))}

      {/* 流程提示卡片（展开时显示） */}
      {!collapsed && (
        <div className="mt-4 mx-1 rounded-lg border bg-muted/30 px-3 py-2.5">
          <p className="text-xs font-medium text-muted-foreground mb-1.5">流程</p>
          <div className="text-xs text-muted-foreground leading-relaxed font-mono">
            <p>节点源 → proxy-providers</p>
            <p>规则集 → rule-providers</p>
            <p className="mt-1 pl-4">↓</p>
            <p className="pl-2">自定义配置组装</p>
            <p className="mt-1 pl-4">↓</p>
            <p className="pl-2">订阅链接下发</p>
          </div>
        </div>
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
