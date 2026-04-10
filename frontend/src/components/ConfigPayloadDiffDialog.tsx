import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { diffWordsWithSpace } from 'diff'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { configPayloadToYaml } from '@/lib/config-payload-yaml'

type ConfigPayloadDiffDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 左侧（已保存 / 服务端）快照 */
  saved: unknown
  /** 右侧（当前草稿）快照 */
  draft: unknown
}

/** 将 YAML 文本做词级 inline diff 并着色（保留空白与换行） */
export function ConfigPayloadDiffDialog({
  open,
  onOpenChange,
  saved,
  draft,
}: ConfigPayloadDiffDialogProps) {
  const { t } = useTranslation()

  const { leftYaml, rightYaml, parts } = useMemo(() => {
    const left = configPayloadToYaml(saved)
    const right = configPayloadToYaml(draft)
    return {
      leftYaml: left,
      rightYaml: right,
      parts: diffWordsWithSpace(left, right),
    }
  }, [saved, draft])

  const hasChange = useMemo(() => leftYaml !== rightYaml, [leftYaml, rightYaml])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t('contextSaveBar.diffTitle')}</DialogTitle>
          <DialogDescription>{t('contextSaveBar.diffDescription')}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[min(60vh,520px)] w-full rounded-md border bg-muted/30">
          <div className="p-3">
            {!hasChange ? (
              <p className="text-sm text-muted-foreground">{t('contextSaveBar.diffNoChanges')}</p>
            ) : (
              <pre
                className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed"
                aria-label={t('contextSaveBar.diffTitle')}
              >
                {parts.map((part, i) => (
                  <span
                    key={i}
                    className={cn(
                      part.added &&
                        cn(
                          'rounded-sm bg-emerald-500/40 px-0.5 text-emerald-950',
                          'ring-1 ring-emerald-600/35 ring-inset',
                          'dark:bg-emerald-500/30 dark:text-emerald-50 dark:ring-emerald-400/30'
                        ),
                      part.removed &&
                        cn(
                          'rounded-sm bg-rose-500/35 px-0.5 text-rose-950',
                          'line-through decoration-rose-700/70 decoration-2',
                          'ring-1 ring-rose-600/30 ring-inset',
                          'dark:bg-rose-500/25 dark:text-rose-50 dark:decoration-rose-300/60 dark:ring-rose-400/25'
                        )
                    )}
                  >
                    {part.value}
                  </span>
                ))}
              </pre>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
