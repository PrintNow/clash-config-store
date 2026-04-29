import type { RuleAnalysis } from '@/domain/rules'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

function getRuleStatusLabel(status: RuleAnalysis['status'], t: (key: string) => string) {
  if (status === 'error') return t('customConfigs.ruleStatusError')
  if (status === 'warning') return t('customConfigs.ruleStatusWarning')
  return t('customConfigs.ruleStatusValid')
}

/** 规则状态色点（与 Badge 语义色一致） */
function getRuleStatusDotClass(status: RuleAnalysis['status']) {
  if (status === 'error') return 'bg-destructive'
  if (status === 'warning') return 'bg-amber-500 dark:bg-amber-400'
  return 'bg-emerald-500 dark:bg-emerald-400'
}

/** 仅颜色圆点 + Tooltip / aria-label，便于紧凑展示且新手可悬停查看含义 */
export function RuleStatusIndicator({
  status,
  t,
}: {
  status: RuleAnalysis['status']
  t: (key: string) => string
}) {
  const label = getRuleStatusLabel(status, t)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          aria-label={label}
          className={cn(
            'inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-border/60',
            getRuleStatusDotClass(status)
          )}
        />
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}
