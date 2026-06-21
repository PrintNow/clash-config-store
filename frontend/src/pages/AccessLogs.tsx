import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2, XCircle, MapPin, Monitor } from 'lucide-react'
import { subscriptionsApi } from '@/api/subscriptions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100]

function formatDateTimeFull(dateStr: string) {
  const d = new Date(dateStr)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function AccessLogs() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const subId = Number(id)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)

  const { data, isLoading } = useQuery({
    queryKey: ['subscriptions', subId, 'access-logs', page, pageSize],
    queryFn: () => subscriptionsApi.getAccessLogs(subId, { page, page_size: pageSize }),
    enabled: !!subId,
  })

  const totalPages = data ? Math.ceil(data.total / pageSize) : 0

  const handlePageSizeChange = (value: number) => {
    setPageSize(value)
    setPage(1)
  }

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
            {t('accessLogs.totalCount', { count: data.total })}
          </span>
        )}
      </div>

      <Card>
        <CardHeader className="py-3 px-4 border-b">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t('common.page', { page })}
              {totalPages > 0 && ` / ${totalPages}`}
            </CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t('accessLogs.perPage')}</span>
              <NativeSelect
                size="sm"
                className="w-20"
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              >
                {PAGE_SIZE_OPTIONS.map((s) => (
                  <NativeSelectOption key={s} value={s}>{s}</NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* 桌面端：完整表格 */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40 whitespace-nowrap">{t('accessLogs.time')}</TableHead>
                  <TableHead className="w-32 whitespace-nowrap">{t('accessLogs.ip')}</TableHead>
                  <TableHead className="w-20 whitespace-nowrap">{t('accessLogs.country')}</TableHead>
                  <TableHead className="w-24 whitespace-nowrap">{t('accessLogs.city')}</TableHead>
                  <TableHead className="w-24 whitespace-nowrap">{t('accessLogs.allowed')}</TableHead>
                  <TableHead>{t('accessLogs.userAgent')}</TableHead>
                  <TableHead>{t('accessLogs.denyReason')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: pageSize > 20 ? 10 : 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : !data?.items?.length ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {t('accessLogs.noLogs')}
                    </TableCell>
                  </TableRow>
                ) : (
                  data.items.map((log) => (
                    <TableRow key={log.id} className={log.allowed ? '' : 'bg-destructive/5'}>
                      <TableCell className="text-xs whitespace-nowrap font-mono text-muted-foreground">
                        {formatDateTimeFull(log.created_at)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{log.ip}</TableCell>
                      <TableCell className="text-xs">
                        {log.country_code ? (
                          <span title={log.country}>{log.country_code}</span>
                        ) : '-'}
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
                      <TableCell className="text-xs text-muted-foreground max-w-xs">
                        <span className="block truncate" title={log.user_agent}>
                          {log.user_agent || '-'}
                        </span>
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

          {/* 移动端：卡片列表 */}
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
                  className={`px-4 py-3 space-y-1 ${log.allowed ? '' : 'bg-destructive/5'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${log.allowed ? 'bg-green-500' : 'bg-destructive'}`} />
                      <span className="font-mono text-xs font-medium">{log.ip}</span>
                      {log.country_code && (
                        <span className="text-xs text-muted-foreground">{log.country_code}</span>
                      )}
                    </div>
                    <time className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTimeFull(log.created_at)}
                    </time>
                  </div>
                  {log.city && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground pl-4">
                      <MapPin className="h-3 w-3" />
                      {log.city}
                    </div>
                  )}
                  {log.user_agent && (
                    <div className="flex items-start gap-1 text-xs text-muted-foreground/70 pl-4">
                      <Monitor className="h-3 w-3 mt-0.5 shrink-0" />
                      <span className="truncate">{log.user_agent}</span>
                    </div>
                  )}
                  {log.deny_reason && (
                    <p className="text-xs text-destructive truncate pl-4">{log.deny_reason}</p>
                  )}
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
