import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BrandLogo } from '@/components/BrandLogo'
import { cn } from '@/lib/utils'

type SidebarBrandProps = {
  /** 移动端抽屉内点击后关闭 */
  onNavigate?: () => void
  className?: string
  collapsed?: boolean
  labelsVisible?: boolean
}

/** 侧栏顶部：Logo + 产品名 */
export function SidebarBrand({
  onNavigate,
  className,
  collapsed = false,
  labelsVisible = !collapsed,
}: SidebarBrandProps) {
  const { t } = useTranslation()
  const brandName = t('nav.brandName')

  return (
    <Link
      to="/dashboard"
      onClick={onNavigate}
      title={collapsed ? brandName : undefined}
      className={cn(
        'flex min-w-0 items-center gap-2.5 rounded-md p-1 -m-1',
        'text-sidebar-foreground hover:text-sidebar-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
        collapsed && 'justify-center',
        className
      )}
    >
      <BrandLogo className="h-9 w-9 shrink-0 rounded-lg shadow-sm" title="" />
      <span
        className={cn(
          'truncate text-left text-base font-bold leading-snug transition-opacity duration-150',
          collapsed && 'sr-only',
          !collapsed && (labelsVisible ? 'opacity-100 delay-75' : 'opacity-0')
        )}
        aria-hidden={!collapsed && !labelsVisible}
      >
        {brandName}
      </span>
    </Link>
  )
}
