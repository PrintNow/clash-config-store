import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleAlert, GitCompare, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useContextSaveBarStore, type ContextSaveBarExtraActionIcon } from '@/store/context-save-bar'

function ExtraActionIcon({ icon }: { icon?: ContextSaveBarExtraActionIcon }) {
  if (icon === 'git-compare') {
    return <GitCompare className="h-4 w-4 shrink-0" aria-hidden />
  }
  return null
}

/** 顶栏居中的 Shopify 风格「未保存」胶囊条 */
export function ContextSaveBar() {
  const { t } = useTranslation()
  const registration = useContextSaveBarStore((s) => s.registration)

  // Mac：⌘S；其它平台：Ctrl+S。有注册页时拦截默认「保存网页」并走顶栏保存逻辑
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 's' && e.key !== 'S') return
      if (!(e.metaKey || e.ctrlKey)) return
      const r = useContextSaveBarStore.getState().registration
      if (!r) return
      e.preventDefault()
      if (!r.saveDisabled) {
        r.onSave()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // 无注册方时不占位（例如非详情页）
  if (!registration) {
    return null
  }

  const { dirty, saving, saveDisabled, onSave, onDiscard, extraActions } = registration

  return (
    <div
      className={cn(
        'flex w-full min-w-0 max-w-[min(100%,26rem)] items-center gap-2 rounded-full border bg-muted/80 px-3 py-2 shadow-sm backdrop-blur-sm',
        'sm:max-w-[min(100%,36rem)] sm:gap-3 sm:px-5 sm:py-2',
        'md:max-w-[min(100%,40rem)] lg:max-w-[min(100%,48rem)]',
        !dirty && 'border-muted/60 bg-muted/50'
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm text-foreground sm:text-base">
        {dirty && (
          <>
            <CircleAlert className="h-4 w-4 shrink-0 text-muted-foreground sm:h-[1.125rem] sm:w-[1.125rem]" aria-hidden />
            <span className="truncate font-medium">{t('contextSaveBar.unsaved')}</span>
          </>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1 sm:gap-2">
        {extraActions?.map((action) => (
          <Button
            key={action.id}
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 px-2 sm:px-3"
            disabled={saving || action.disabled}
            onClick={() => action.onClick()}
          >
            <ExtraActionIcon icon={action.icon} />
            <span className="max-w-[7rem] truncate sm:max-w-none">{action.label}</span>
          </Button>
        ))}
        {dirty && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 px-2 sm:h-9 sm:px-3"
              disabled={saving}
              onClick={() => onDiscard()}
            >
              {t('contextSaveBar.discard')}
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-9 shrink-0 rounded-full px-3 sm:px-4"
              disabled={saveDisabled}
              onClick={() => onSave()}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="hidden sm:inline">{t('common.saving')}</span>
                </>
              ) : (
                t('common.save')
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
