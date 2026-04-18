import { useTranslation } from 'react-i18next'
import { Github } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BUILD_LABEL } from '@/lib/buildInfo'
import { REPO_URL } from '@/lib/repo'

type SiteFooterProps = {
  className?: string
}

/** 仅用于登录/注册等无侧栏页面：GitHub + 构建标签 */
export function SiteFooter({ className }: SiteFooterProps) {
  const { t } = useTranslation()

  return (
    <footer
      className={cn(
        'shrink-0 border-t border-border bg-background px-4 py-3',
        className
      )}
    >
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-2 text-center sm:flex-row sm:items-center sm:gap-3">
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={t('footer.repoLinkA11y')}
        >
          <Github className="h-4 w-4 shrink-0" aria-hidden />
          <span className="font-medium text-foreground/90">{t('footer.github')}</span>
        </a>
        <span className="hidden text-muted-foreground sm:inline" aria-hidden>
          ·
        </span>
        <span
          className="font-mono text-xs tabular-nums text-muted-foreground"
          title={t('footer.buildLabelTitle')}
        >
          {BUILD_LABEL}
        </span>
      </div>
    </footer>
  )
}
