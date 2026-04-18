import { useTranslation } from 'react-i18next'
import { Github } from 'lucide-react'
import { BUILD_LABEL } from '@/lib/buildInfo'
import { REPO_URL } from '@/lib/repo'

/** 侧栏底部：紧凑 GitHub 链接 + 构建标签 */
export function SidebarFooter() {
  const { t } = useTranslation()

  return (
    <div className="shrink-0 border-t border-sidebar-border px-3 py-2.5">
      <a
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-md text-xs text-sidebar-foreground/80 transition-colors hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        aria-label={t('footer.repoLinkA11y')}
      >
        <Github className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="font-medium">{t('footer.github')}</span>
      </a>
      <p
        className="mt-1 font-mono text-[11px] tabular-nums text-muted-foreground"
        title={t('footer.buildLabelTitle')}
      >
        {BUILD_LABEL}
      </p>
    </div>
  )
}
