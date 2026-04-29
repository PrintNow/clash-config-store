import { useTranslation } from 'react-i18next'
import { CalendarDays } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatBytes, calcUsagePercent, formatExpireDate, daysRemaining } from './traffic-utils'

interface TrafficCellProps {
  upload?: number | null
  download?: number | null
  total?: number | null
  expireAt?: string | null
}

function percentBadgeVariant(p: number) {
  if (p >= 90) return 'destructive' as const
  if (p >= 75) return 'secondary' as const
  return 'outline' as const
}

function progressColor(p: number) {
  if (p >= 90) return 'bg-destructive'
  if (p >= 75) return 'bg-amber-500'
  return 'bg-emerald-500'
}

export function TrafficCell({ upload, download, total, expireAt }: TrafficCellProps) {
  const { t } = useTranslation()
  const percent = calcUsagePercent(upload, download, total)
  const used = (upload ?? 0) + (download ?? 0)
  const expireStr = formatExpireDate(expireAt)
  const days = daysRemaining(expireAt)

  // 无任何流量数据
  if (percent === null && !expireStr) {
    return <span className="text-muted-foreground text-sm">-</span>
  }

  return (
    <div className="min-w-[180px] space-y-2">
      {/* 流量使用量 + 百分比 */}
      {percent !== null && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="space-y-1.5">
                {/* 第一行：已用 | 百分比 badge */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold tabular-nums truncate">
                    {formatBytes(used)}
                  </span>
                  <Badge
                    variant={percentBadgeVariant(percent)}
                    className={cn(
                      'shrink-0 text-[11px] font-bold tabular-nums px-1.5 py-0',
                      percent < 75 && 'border-emerald-500/50 text-emerald-600'
                    )}
                  >
                    {percent}%
                  </Badge>
                </div>

                {/* 进度条 */}
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn('h-full rounded-full transition-all', progressColor(percent))}
                    style={{ width: `${percent}%` }}
                  />
                </div>

                {/* 第三行：总量 */}
                <p className="text-[11px] text-muted-foreground">
                  {t('providers.trafficTotal')}: {formatBytes(total)}
                </p>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1 text-xs">
                <p>{t('providers.trafficUpload')}: {formatBytes(upload ?? 0)}</p>
                <p>{t('providers.trafficDownload')}: {formatBytes(download ?? 0)}</p>
                <p>{t('providers.trafficTotal')}: {formatBytes(total)}</p>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* 到期时间 */}
      {expireStr && (
        <div
          className={cn(
            'flex items-center gap-1.5 text-[11px]',
            days !== null && days < 0
              ? 'text-destructive font-medium'
              : days !== null && days <= 7
                ? 'text-amber-600 font-medium'
                : 'text-muted-foreground'
          )}
        >
          <CalendarDays className="h-3 w-3 shrink-0" />
          <span>{expireStr}</span>
          {days !== null && (
            <span className="ml-auto">
              {days < 0
                ? t('providers.trafficExpired')
                : days === 0
                  ? t('providers.trafficExpiresToday')
                  : t('providers.trafficDaysLeft', { count: days })}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
