import { useTranslation } from 'react-i18next'
import { Github, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { BUILD_LABEL } from '@/lib/buildInfo'
import { REPO_URL } from '@/lib/repo'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type SidebarFooterProps = {
  collapsed?: boolean
  labelsVisible?: boolean
  onToggleCollapse?: () => void
}

/** 侧栏底部：紧凑 GitHub 链接 + 构建标签 */
export function SidebarFooter({
  collapsed = false,
  labelsVisible = !collapsed,
  onToggleCollapse,
}: SidebarFooterProps) {
  const { t } = useTranslation()
  const toggleLabel = collapsed ? t('layout.expandSidebar') : t('layout.collapseSidebar')

  return (
    <div
      className={cn(
        'shrink-0 border-t border-sidebar-border px-3 py-2.5',
        collapsed && 'flex flex-col items-center gap-1 px-2'
      )}
    >
      <div className={cn('flex items-center', collapsed ? 'flex-col gap-1' : 'gap-2')}>
        {!collapsed && labelsVisible && (
          <a
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-w-0 items-center gap-2 rounded-md px-1 py-1 text-xs text-sidebar-foreground/80 transition-colors hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            aria-label={t('footer.repoLinkA11y')}
          >
            <Github className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate font-medium">{t('footer.github')}</span>
          </a>
        )}
        {!collapsed && labelsVisible && (
          <span
            className="rounded-md bg-sidebar-accent px-1.5 py-0.5 font-mono text-[11px] tabular-nums text-muted-foreground"
            title={t('footer.buildLabelTitle')}
          >
            {BUILD_LABEL}
          </span>
        )}
        {onToggleCollapse && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn('h-9 w-9 shrink-0 text-sidebar-foreground/80', !collapsed && 'ml-auto')}
            onClick={onToggleCollapse}
            aria-label={toggleLabel}
            title={toggleLabel}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  )
}
