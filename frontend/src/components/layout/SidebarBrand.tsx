import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BrandLogo } from '@/components/BrandLogo'
import { cn } from '@/lib/utils'

type SidebarBrandProps = {
  /** 移动端抽屉内点击后关闭 */
  onNavigate?: () => void
  className?: string
}

/** 侧栏顶部：Logo + 产品名 */
export function SidebarBrand({ onNavigate, className }: SidebarBrandProps) {
  const { t } = useTranslation()

  return (
    <Link
      to="/dashboard"
      onClick={onNavigate}
      className={cn(
        'flex min-w-0 items-center gap-2.5 rounded-md p-1 -m-1',
        'text-sidebar-foreground hover:text-sidebar-accent-foreground',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
        className
      )}
    >
      <BrandLogo className="h-9 w-9 shrink-0 rounded-lg shadow-sm" title="" />
      <span className="truncate text-left text-base font-bold leading-snug">
        {t('nav.brandName')}
      </span>
    </Link>
  )
}
