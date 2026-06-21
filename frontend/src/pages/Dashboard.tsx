import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Activity,
  Globe,
  Link,
  Settings2,
  FileCode2,
  BookOpen,
  RefreshCw,
  Copy,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ArrowRight,
  ChevronDown,
  MapPin,
  Server,
  Wifi,
  HardDrive,
} from 'lucide-react'
import { dashboardApi } from '@/api/dashboard'
import { providersApi } from '@/api/providers'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { ProviderStatus, SubscriptionHealth, AccessLog } from '@/types'

export function Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [refreshingIds, setRefreshingIds] = useState<Set<number>>(new Set())
  const [onboardingOpen, setOnboardingOpen] = useState<boolean | null>(null)

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.getStats,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })

  useEffect(() => {
    if (stats) {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
    }
  }, [stats, queryClient])

  const refreshAllMutation = useMutation({
    mutationFn: dashboardApi.refreshAllProviders,
    onSuccess: () => {
      toast.success(t('dashboard.refreshAllSuccess'))
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: () => {
      toast.error(t('common.error'))
    },
  })

  const handleRefreshProvider = async (id: number) => {
    setRefreshingIds((prev) => new Set(prev).add(id))
    try {
      await providersApi.refresh(id)
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    } catch {
      toast.error(t('common.error'))
    } finally {
      setRefreshingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const handleCopyLink = (sub: SubscriptionHealth) => {
    navigator.clipboard.writeText(sub.subscription_url).then(() => {
      setCopiedId(sub.id)
      toast.success(t('subscriptions.copySuccess'))
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const statCards = [
    {
      key: 'providers',
      title: t('dashboard.totalProviders'),
      value: stats?.total_providers ?? 0,
      icon: Globe,
      color: 'text-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-950',
      path: '/providers',
    },
    {
      key: 'subscriptions',
      title: t('dashboard.totalSubscriptions'),
      value: stats?.total_subscriptions ?? 0,
      icon: Link,
      color: 'text-green-500',
      bg: 'bg-green-50 dark:bg-green-950',
      path: '/subscriptions',
    },
    {
      key: 'customConfigs',
      title: t('dashboard.totalCustomConfigs'),
      value: stats?.total_custom_configs ?? 0,
      icon: Settings2,
      color: 'text-purple-500',
      bg: 'bg-purple-50 dark:bg-purple-950',
      path: '/custom-configs',
    },
    {
      key: 'configTemplates',
      title: t('dashboard.totalConfigTemplates'),
      value: stats?.total_config_templates ?? 0,
      icon: FileCode2,
      color: 'text-orange-500',
      bg: 'bg-orange-50 dark:bg-orange-950',
      path: '/config-templates',
    },
    {
      key: 'ruleProviders',
      title: t('dashboard.totalRuleProviders'),
      value: stats?.total_rule_providers ?? 0,
      icon: BookOpen,
      color: 'text-teal-500',
      bg: 'bg-teal-50 dark:bg-teal-950',
      path: '/rule-providers',
    },
  ]

  const hasMissingOnboardingStep = Boolean(
    stats &&
    (stats.total_providers === 0 ||
      stats.total_custom_configs === 0 ||
      stats.total_subscriptions === 0)
  )
  const showOnboardingGuide = Boolean(!isLoading && stats)
  const isOnboardingOpen = onboardingOpen ?? hasMissingOnboardingStep

  const onboardingSteps = [
    {
      title: t('onboarding.stepProviderTitle'),
      description: t('onboarding.stepProviderDescription'),
      path: '/providers',
      done: (stats?.total_providers ?? 0) > 0,
    },
    {
      title: t('onboarding.stepConfigTitle'),
      description: t('onboarding.stepConfigDescription'),
      path: '/custom-configs',
      done: (stats?.total_custom_configs ?? 0) > 0,
    },
    {
      title: t('onboarding.stepSubscriptionTitle'),
      description: t('onboarding.stepSubscriptionDescription'),
      path: '/subscriptions',
      done: (stats?.total_subscriptions ?? 0) > 0,
    },
  ]
  const completedOnboardingSteps = onboardingSteps.filter((step) => step.done).length
  const recentLogs = stats?.recent_access_logs?.slice(0, 10) ?? []
  const recentAllowedCount = recentLogs.filter((log) => log.allowed).length
  const recentDeniedCount = recentLogs.length - recentAllowedCount
  const staleProviderCount = stats?.providers?.filter((provider) => provider.type !== 'inline' && (provider.cache_stale || provider.fetch_error)).length ?? 0
  const expiringSubscriptionCount = stats?.subscriptions?.filter((sub) => sub.token_expired).length ?? 0

  const renderCacheBadge = (provider: ProviderStatus) => {
    if (provider.cache_stale) {
      return (
        <Badge variant="destructive" className="text-xs">
          {t('dashboard.cacheStale')}
        </Badge>
      )
    }
    return (
      <Badge variant="success" className="text-xs">
        {t('dashboard.cacheOk')}
      </Badge>
    )
  }

  const renderTokenBadge = (sub: SubscriptionHealth) => {
    if (sub.token_expired) {
      return (
        <Badge variant="destructive" className="text-xs">
          {t('dashboard.tokenExpired')}
        </Badge>
      )
    }
    if (!sub.token_expired_at) {
      return (
        <Badge variant="success" className="text-xs">
          {t('dashboard.tokenNeverExpires')}
        </Badge>
      )
    }
    return (
      <Badge variant="warning" className="text-xs">
        {t('dashboard.daysLeft', { days: sub.days_until_expiry })}
      </Badge>
    )
  }

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000)
    if (diffMin < 1) return t('dashboard.relativeJustNow')
    if (diffMin < 60) return t('dashboard.relativeMinutesAgo', { count: diffMin })
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return t('dashboard.relativeHoursAgo', { count: diffH })
    const diffD = Math.floor(diffH / 24)
    return t('dashboard.relativeDaysAgo', { count: diffD })
  }

  const formatDateTimeFull = (dateStr: string) => {
    const d = new Date(dateStr)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  }

  const getLogLocation = (log: AccessLog) => {
    const location = [log.country, log.city].filter(Boolean).join(' / ')
    return location || t('dashboard.unknownLocation')
  }

  return (
    <div className="space-y-4">
      {/* 顶部操作区 */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-bold tracking-tight">{t('dashboard.title')}</h1>
        <Button
          onClick={() => refreshAllMutation.mutate()}
          disabled={refreshAllMutation.isPending}
          size="sm"
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshAllMutation.isPending ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{t('dashboard.refreshAll')}</span>
        </Button>
      </div>

      {/* Onboarding 引导卡片（可折叠） */}
      {showOnboardingGuide && (
        <Card className="border-primary/20 bg-muted/20">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <CardTitle className="text-sm font-semibold">{t('onboarding.dashboardTitle')}</CardTitle>
                <Badge variant={hasMissingOnboardingStep ? 'outline' : 'success'} className="text-xs shrink-0">
                  {t('onboarding.progress', {
                    done: completedOnboardingSteps,
                    total: onboardingSteps.length,
                  })}
                </Badge>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 gap-1 shrink-0"
                onClick={() => setOnboardingOpen((open) => !(open ?? hasMissingOnboardingStep))}
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOnboardingOpen ? 'rotate-180' : ''}`} />
              </Button>
            </div>
            {!isOnboardingOpen && (
              <p className="text-xs text-muted-foreground mt-0.5">{t('onboarding.dashboardDescription')}</p>
            )}
          </CardHeader>
          {isOnboardingOpen && (
            <CardContent className="px-4 pb-3 pt-0">
              <div className="grid gap-2 sm:grid-cols-3">
                {onboardingSteps.map((step, index) => (
                  <button
                    key={step.path}
                    type="button"
                    onClick={() => navigate(step.path)}
                    className="rounded-lg border bg-background p-2.5 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Badge variant={step.done ? 'success' : 'outline'} className="h-4 px-1 text-xs shrink-0">
                            {step.done ? t('onboarding.done') : index + 1}
                          </Badge>
                          <p className="text-xs font-medium truncate">{step.title}</p>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground mt-0.5" />
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* 核心资源指标：移动端2列，桌面5列 */}
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-5">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <button
              key={card.key}
              type="button"
              className="group rounded-xl border bg-card p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
              onClick={() => navigate(card.path)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground">{card.title}</p>
                  {isLoading ? (
                    <Skeleton className="mt-2 h-7 w-10" />
                  ) : (
                    <p className="mt-1 text-2xl font-bold tracking-tight">{card.value}</p>
                  )}
                </div>
                <div className={`rounded-lg p-1.5 transition-transform group-hover:scale-105 ${card.bg}`}>
                  <Icon className={`h-3.5 w-3.5 ${card.color}`} />
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* 两列布局：Provider 状态 + 订阅健康 */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* 左列：订阅源状态 */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/20 py-3 px-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <Server className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('dashboard.providerStatus')}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">{t('dashboard.providerStatusDescription')}</CardDescription>
              </div>
              <Badge variant={staleProviderCount > 0 ? 'warning' : 'success'} className="shrink-0 text-xs">
                {staleProviderCount > 0
                  ? t('dashboard.needAttention', { count: staleProviderCount })
                  : t('dashboard.allClear')}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : !stats?.providers?.length ? (
              <p className="text-center text-sm text-muted-foreground py-4">{t('common.noData')}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {stats.providers.map((provider: ProviderStatus) => (
                <div
                  key={provider.id}
                  className="rounded-lg border bg-background/70 p-2.5 transition-colors hover:bg-muted/30"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
                      <span className="font-medium truncate text-sm">{provider.name}</span>
                      {provider.type === 'inline' ? (
                        <Badge variant="secondary" className="text-xs gap-1 shrink-0">
                          <HardDrive className="h-2.5 w-2.5" />
                          {t('dashboard.inlineProvider')}
                        </Badge>
                      ) : (
                        renderCacheBadge(provider)
                      )}
                    </div>
                    {provider.type !== 'inline' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 shrink-0"
                        disabled={refreshingIds.has(provider.id)}
                        onClick={() => handleRefreshProvider(provider.id)}
                      >
                        <RefreshCw
                          className={`h-3 w-3 ${refreshingIds.has(provider.id) ? 'animate-spin' : ''}`}
                        />
                      </Button>
                    )}
                  </div>
                  {provider.type === 'inline' ? (
                    <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {t('dashboard.lastFetched')}：{new Date(provider.updated_at).toLocaleString()}
                      </span>
                    </div>
                  ) : (
                    <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3 shrink-0" />
                      <span className="truncate">
                        {t('dashboard.lastFetched')}：
                        {provider.last_fetched_at
                          ? new Date(provider.last_fetched_at).toLocaleString()
                          : t('dashboard.neverFetched')}
                      </span>
                    </div>
                  )}
                  {provider.fetch_error && (
                    <div className="mt-1 flex items-start gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                      <span className="break-all">{provider.fetch_error}</span>
                    </div>
                  )}
                </div>
              ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 右列：订阅健康 */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/20 py-3 px-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <Wifi className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('dashboard.subscriptionHealth')}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">{t('dashboard.subscriptionHealthDescription')}</CardDescription>
              </div>
              <Badge variant={expiringSubscriptionCount > 0 ? 'warning' : 'success'} className="shrink-0 text-xs">
                {expiringSubscriptionCount > 0
                  ? t('dashboard.needAttention', { count: expiringSubscriptionCount })
                  : t('dashboard.allClear')}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : !stats?.subscriptions?.length ? (
              <p className="text-center text-sm text-muted-foreground py-4">{t('common.noData')}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {stats.subscriptions.map((sub: SubscriptionHealth) => (
                  <div
                    key={sub.id}
                    className="rounded-lg border bg-background/70 p-2.5 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            sub.token_expired ? 'bg-destructive' : 'bg-green-500'
                          }`}
                        />
                        <span className="font-medium truncate text-sm">{sub.name}</span>
                        {renderTokenBadge(sub)}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 shrink-0"
                        onClick={() => handleCopyLink(sub)}
                      >
                        {copiedId === sub.id ? (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                      <Badge
                        variant={sub.has_custom_config ? 'secondary' : 'outline'}
                        className="text-xs h-4 px-1"
                      >
                        {sub.has_custom_config
                          ? t('dashboard.hasCustomConfig')
                          : t('dashboard.noCustomConfig')}
                      </Badge>
                      <Badge
                        variant={sub.has_config_template ? 'secondary' : 'outline'}
                        className="text-xs h-4 px-1"
                      >
                        {sub.has_config_template
                          ? t('dashboard.hasConfigTemplate')
                          : t('dashboard.noConfigTemplate')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 最近访问日志 */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/20 py-3 px-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-1.5 text-sm">
                <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                {t('dashboard.recentLogs')}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">{t('dashboard.recentLogsDescription')}</CardDescription>
            </div>
            <TooltipProvider delayDuration={0} skipDelayDuration={0}>
              <div className="flex gap-1.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="success" className="cursor-help gap-1 text-xs">
                      <CheckCircle2 className="h-3 w-3" />
                      {t('dashboard.allowedCount', { count: recentAllowedCount })}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>{t('dashboard.allowedCountTooltip')}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant={recentDeniedCount > 0 ? 'destructive' : 'outline'} className="cursor-help gap-1 text-xs">
                      <XCircle className="h-3 w-3" />
                      {t('dashboard.deniedCount', { count: recentDeniedCount })}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>{t('dashboard.deniedCountTooltip')}</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CardContent className="p-3">
          {isLoading ? (
            <div className="space-y-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : !stats?.recent_access_logs?.length ? (
            <div className="rounded-xl border border-dashed py-8 text-center">
              <Activity className="mx-auto h-7 w-7 text-muted-foreground/60" />
              <p className="mt-2 text-sm font-medium">{t('dashboard.noRecentLogsTitle')}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t('dashboard.noRecentLogsDescription')}</p>
            </div>
          ) : (
            <div className="divide-y rounded-xl border">
              {recentLogs.map((log: AccessLog) => (
                <div
                  key={log.id}
                  className={`flex min-w-0 items-center gap-2 px-3 py-2 text-sm transition-colors ${
                    log.allowed
                      ? 'bg-background/70 hover:bg-green-500/5'
                      : 'bg-destructive/5 hover:bg-destructive/10'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                      log.allowed ? 'bg-green-500' : 'bg-destructive'
                    }`}
                  />
                  {/* 主行：订阅名+IP / 地理+原因 / 时间 */}
                  <span className="min-w-0 flex-1 flex items-start gap-2">
                    {/* 订阅名 + IP */}
                    <span className="shrink-0 w-28">
                      <span className="block truncate text-xs font-medium" title={log.subscription_name}>{log.subscription_name}</span>
                      <span className="block truncate font-mono text-[10px] text-muted-foreground">{log.ip}</span>
                    </span>
                    {/* 地理位置 + 拒绝原因 + UA */}
                    <span className="hidden sm:block min-w-0 flex-1">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{getLogLocation(log)}</span>
                        {log.deny_reason && (
                          <>
                            <span className="text-muted-foreground/60">/</span>
                            <span className="truncate text-destructive">{log.deny_reason}</span>
                          </>
                        )}
                      </span>
                      {log.user_agent && (
                        <span className="block truncate text-[10px] text-muted-foreground/60 mt-0.5" title={log.user_agent}>
                          {log.user_agent}
                        </span>
                      )}
                    </span>
                    {/* 移动端：拒绝原因简要 */}
                    {log.deny_reason ? (
                      <span className="sm:hidden flex-1 truncate text-xs text-destructive">{log.deny_reason}</span>
                    ) : (
                      <span className="sm:hidden flex-1" />
                    )}
                  </span>
                  {/* 时间：完整时间 + 相对时间 */}
                  <time className="shrink-0 text-right" dateTime={log.created_at}>
                    <span className="block text-xs text-foreground/80 whitespace-nowrap font-mono">{formatDateTimeFull(log.created_at)}</span>
                    <span className="block text-[10px] text-muted-foreground whitespace-nowrap">{formatRelativeTime(log.created_at)}</span>
                  </time>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
