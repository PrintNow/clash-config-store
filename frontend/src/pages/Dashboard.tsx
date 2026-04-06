import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Globe, Link, Settings2, CheckCircle2, XCircle } from 'lucide-react'
import { dashboardApi } from '@/api/dashboard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export function Dashboard() {
  const { t } = useTranslation()

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardApi.getStats,
  })

  const statCards = [
    {
      title: t('dashboard.totalProviders'),
      value: stats?.total_providers ?? 0,
      icon: Globe,
      color: 'text-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-950',
    },
    {
      title: t('dashboard.totalSubscriptions'),
      value: stats?.total_subscriptions ?? 0,
      icon: Link,
      color: 'text-green-500',
      bg: 'bg-green-50 dark:bg-green-950',
    },
    {
      title: t('dashboard.totalCustomConfigs'),
      value: stats?.total_custom_configs ?? 0,
      icon: Settings2,
      color: 'text-purple-500',
      bg: 'bg-purple-50 dark:bg-purple-950',
    },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('dashboard.title')}</h1>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-3">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <div className={`rounded-lg p-2 ${card.bg}`}>
                  <Icon className={`h-5 w-5 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-16" />
                ) : (
                  <div className="text-3xl font-bold">{card.value}</div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* 最近访问日志 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dashboard.recentLogs')}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('dashboard.time')}</TableHead>
                  <TableHead>{t('dashboard.ip')}</TableHead>
                  <TableHead>{t('dashboard.country')}</TableHead>
                  <TableHead>{t('dashboard.allowed')}</TableHead>
                  <TableHead>{t('dashboard.denyReason')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!stats?.recent_access_logs?.length ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      {t('common.noData')}
                    </TableCell>
                  </TableRow>
                ) : (
                  stats.recent_access_logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{log.ip}</TableCell>
                      <TableCell>
                        {log.country ? `${log.country}${log.city ? ` / ${log.city}` : ''}` : '-'}
                      </TableCell>
                      <TableCell>
                        {log.allowed ? (
                          <Badge variant="success" className="flex items-center gap-1 w-fit">
                            <CheckCircle2 className="h-3 w-3" />
                            {t('accessLogs.allowedBadge')}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                            <XCircle className="h-3 w-3" />
                            {t('accessLogs.deniedBadge')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.deny_reason || '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
