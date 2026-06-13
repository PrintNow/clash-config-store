import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2, XCircle, MapPin, Clock } from 'lucide-react'
import { subscriptionsApi } from '@/api/subscriptions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const PAGE_SIZE = 20

export function AccessLogs() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const subId = Number(id)
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['subscriptions', subId, 'access-logs', page],
    queryFn: () => subscriptionsApi.getAccessLogs(subId, { page, page_size: PAGE_SIZE }),
    enabled: !!subId,
  })

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => navigate(`/subscriptions/${subId}`)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold">{t('accessLogs.title')}</h1>
        {data && (
          <span className="text-sm text-muted-foreground">
            共 {data.total} 条
          </span>
        )}
      </div>

      <Card>
        <CardHeader className="py-3 px-4 border-b">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t('common.page', { page })}
            {totalPages > 0 && ` / ${totalPages}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* 桌面端：完整表格 */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-36">{t('accessLogs.time')}</TableHead>
                  <TableHead className="w-32">{t('accessLogs.ip')}</TableHead>
                  <TableHead className="w-16">{t('accessLogs.country')}</TableHead>
                  <TableHead>{t('accessLogs.city')}</TableHead>
                  <TableHead className="w-20">{t('accessLogs.allowed')}</TableHead>
                  <TableHead>{t('accessLogs.denyReason')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !data?.items?.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      {t('accessLogs.noLogs')}
                    </TableCell>
                  </TableRow>
                ) : (
                  data.items.map((log) => (
                    <TableRow key={log.id} className={log.allowed ? '' : 'bg-destructive/5'}>
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{log.ip}</TableCell>
                      <TableCell className="text-xs">
                        {log.country_code ? (
                          <span title={log.country}>{log.country_code}</span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{log.city || '-'}</TableCell>
                      <TableCell>
                        {log.allowed ? (
                          <Badge variant="success" className="flex items-center gap-1 w-fit text-xs">
                            <CheckCircle2 className="h-3 w-3" />
                            {t('accessLogs.allowedBadge')}
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="flex items-center gap-1 w-fit text-xs">
                            <XCircle className="h-3 w-3" />
                            {t('accessLogs.deniedBadge')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.deny_reason || '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* 移动端：卡片列表，只显示关键信息 */}
          <div className="md:hidden divide-y">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="px-4 py-3">
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              ))
            ) : !data?.items?.length ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                {t('accessLogs.noLogs')}
              </p>
            ) : (
              data.items.map((log) => (
                <div
                  key={log.id}
                  className={`flex items-center gap-3 px-4 py-2.5 ${log.allowed ? '' : 'bg-destructive/5'}`}
                >
                  {/* 状态指示点 */}
                  <span
                    className={`h-2 w-2 shrink-0 rounded-full ${log.allowed ? 'bg-green-500' : 'bg-destructive'}`}
                  />
                  {/* IP + 位置 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-medium">{log.ip}</span>
                      {log.country_code && (
                        <span className="text-xs text-muted-foreground">{log.country_code}</span>
                      )}
                    </div>
                    {log.deny_reason && (
                      <p className="text-xs text-destructive truncate mt-0.5">{log.deny_reason}</p>
                    )}
                    {!log.deny_reason && log.city && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3" />
                        {log.city}
                      </p>
                    )}
                  </div>
                  {/* 时间 */}
                  <div className="shrink-0 text-right">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <time dateTime={log.created_at}>
                        {new Date(log.created_at).toLocaleTimeString()}
                      </time>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {new Date(log.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 分页控制 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-t">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || isLoading}
              >
                <ChevronLeft className="h-4 w-4" />
                {t('common.prev')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages || isLoading}
              >
                {t('common.next')}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
