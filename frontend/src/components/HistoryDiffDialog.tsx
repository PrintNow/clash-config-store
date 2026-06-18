import { useMemo } from 'react'
import { diffLines, type Change } from 'diff'
import { useTranslation } from 'react-i18next'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { configPayloadToYaml } from '@/lib/config-payload-yaml'

export interface HistorySnapshot {
  proxy_groups: unknown[]
  rules: string[]
  rule_provider_ids: number[]
  hosted_rule_set_ids: number[]
}

interface HistoryDiffDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 更旧的版本（null 表示此条为最早版本） */
  oldSnapshot: HistorySnapshot | null
  /** 更新的版本 */
  newSnapshot: HistorySnapshot
  /** 显示在标题区的时间信息 */
  savedAt: string
}

type DiffLine = { kind: 'line'; type: 'added' | 'removed' | 'unchanged'; text: string }
type FoldBlock = { kind: 'fold'; count: number }
type RenderItem = DiffLine | FoldBlock

const CONTEXT = 3

function buildRenderItems(parts: Change[]): RenderItem[] {
  const lines: DiffLine[] = []
  for (const part of parts) {
    const type: DiffLine['type'] = part.added ? 'added' : part.removed ? 'removed' : 'unchanged'
    const texts = part.value.split('\n')
    if (texts[texts.length - 1] === '') texts.pop()
    for (const text of texts) {
      lines.push({ kind: 'line', type, text })
    }
  }

  const visible = new Array(lines.length).fill(false)
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].type !== 'unchanged') {
      const lo = Math.max(0, i - CONTEXT)
      const hi = Math.min(lines.length - 1, i + CONTEXT)
      for (let j = lo; j <= hi; j++) visible[j] = true
    }
  }

  const items: RenderItem[] = []
  let foldCount = 0
  for (let i = 0; i < lines.length; i++) {
    if (visible[i]) {
      if (foldCount > 0) {
        items.push({ kind: 'fold', count: foldCount })
        foldCount = 0
      }
      items.push(lines[i])
    } else {
      foldCount++
    }
  }
  if (foldCount > 0) {
    items.push({ kind: 'fold', count: foldCount })
  }
  return items
}

export function HistoryDiffDialog({
  open,
  onOpenChange,
  oldSnapshot,
  newSnapshot,
  savedAt,
}: HistoryDiffDialogProps) {
  const { t } = useTranslation()

  const { items, hasChange } = useMemo(() => {
    if (!oldSnapshot) return { items: [], hasChange: false }
    const oldYaml = configPayloadToYaml(oldSnapshot)
    const newYaml = configPayloadToYaml(newSnapshot)
    if (oldYaml === newYaml) return { items: [], hasChange: false }
    const parts = diffLines(oldYaml, newYaml)
    return { items: buildRenderItems(parts), hasChange: true }
  }, [oldSnapshot, newSnapshot])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t('configHistory.diffTitle')}</DialogTitle>
          <DialogDescription>
            {t('configHistory.timeLabel')} {savedAt}
          </DialogDescription>
        </DialogHeader>
        <div className="h-[min(60vh,520px)] w-full overflow-y-auto overflow-x-auto rounded-md border bg-muted/30">
          <div className="p-3">
            {!oldSnapshot ? (
              <p className="text-sm text-muted-foreground">{t('configHistory.diffEarliest')}</p>
            ) : !hasChange ? (
              <p className="text-sm text-muted-foreground">{t('configHistory.diffNoChanges')}</p>
            ) : (
              <pre className="font-mono text-xs leading-relaxed whitespace-pre">
                {items.map((item, i) => {
                  if (item.kind === 'fold') {
                    return (
                      <div
                        key={i}
                        className="text-muted-foreground/60 select-none px-2 py-0.5 text-center text-[11px]"
                      >
                        ···&nbsp;{t('configHistory.diffFold', { count: item.count })}&nbsp;···
                      </div>
                    )
                  }
                  return (
                    <div
                      key={i}
                      className={cn(
                        'px-2',
                        item.type === 'added' &&
                          'bg-emerald-500/20 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-100',
                        item.type === 'removed' &&
                          'bg-rose-500/20 text-rose-900 dark:bg-rose-500/20 dark:text-rose-100'
                      )}
                    >
                      <span className="select-none mr-1 opacity-60">
                        {item.type === 'added' ? '+' : item.type === 'removed' ? '-' : ' '}
                      </span>
                      {item.text}
                    </div>
                  )
                })}
              </pre>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
