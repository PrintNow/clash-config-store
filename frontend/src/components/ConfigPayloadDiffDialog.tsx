import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { diffWordsWithSpace } from 'diff'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const firstChangeRef = useRef<HTMLSpanElement | null>(null)

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

  const firstChangeIndex = useMemo(() => {
    if (!hasChange) return -1
    return parts.findIndex((p) => p.added || p.removed)
  }, [hasChange, parts])

  const scrollToFirstChange = useMemo(() => {
    return () => {
      const container = scrollContainerRef.current
      const target = firstChangeRef.current
      if (!container || !target) return false
      const cRect = container.getBoundingClientRect()
      const tRect = target.getBoundingClientRect()
      const nextTop = container.scrollTop + (tRect.top - cRect.top) - 10
      container.scrollTo({ top: Math.max(0, nextTop), behavior: 'auto' })
      return true
    }
  }, [])

  // 布局提交后立刻试一次（Radix ScrollArea + scrollIntoView 不可靠，已改为原生 overflow + scrollTop）
  useLayoutEffect(() => {
    if (!open || !hasChange || firstChangeIndex < 0) return
    scrollToFirstChange()
  }, [open, hasChange, firstChangeIndex, scrollToFirstChange, leftYaml, rightYaml])

  // Dialog zoom 动画约 200ms，再补几次避免首帧矩形不准
  useEffect(() => {
    if (!open || !hasChange || firstChangeIndex < 0) return
    let cancelled = false
    const delays = [50, 150, 320, 500]
    const ids = delays.map((ms) =>
      window.setTimeout(() => {
        if (!cancelled) scrollToFirstChange()
      }, ms)
    )
    return () => {
      cancelled = true
      ids.forEach(clearTimeout)
    }
  }, [open, hasChange, firstChangeIndex, scrollToFirstChange, leftYaml, rightYaml])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t('contextSaveBar.diffTitle')}</DialogTitle>
          <DialogDescription>{t('contextSaveBar.diffDescription')}</DialogDescription>
        </DialogHeader>
        <div
          ref={scrollContainerRef}
          className="h-[min(60vh,520px)] w-full overflow-y-auto overflow-x-auto rounded-md border bg-muted/30"
        >
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
                    ref={i === firstChangeIndex ? firstChangeRef : undefined}
                    className={cn(
                      i === firstChangeIndex && 'scroll-mt-3',
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
