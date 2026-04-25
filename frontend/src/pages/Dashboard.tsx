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
  ShieldAlert,
  ShieldCheck,
  Wifi,
} from 'lucide-react'
import { dashboardApi } from '@/api/dashboard'
import { providersApi } from '@/api/providers'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { ProviderStatus, SubscriptionHealth, AccessLog } from '@/types'

export function Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // 已复制状态，用于显示复制反馈（key: subscription id）
  const [copiedId, setCopiedId] = useState<number | null>(null)
  // 正在刷新中的 provider id 集合
  const [refreshingIds, setRefreshingIds] = useState<Set<number>>(new Set())
  // null 表示按当前账号状态决定默认展开/收起
  const [onboardingOpen, setOnboardingOpen] = useState<boolean | null>(null)

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardApi.getStats,
  })

  // 仪表盘展示最新访问日志后，使订阅列表上的 access_log_count 缓存失效，避免长期显示 0
  useEffect(() => {
    if (stats) {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
    }
  }, [stats, queryClient])

  // 一键刷新所有订阅源
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

  // 刷新单个 provider 并 invalidate 仪表盘数据
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

  // 复制订阅链接
  const handleCopyLink = (sub: SubscriptionHealth) => {
    navigator.clipboard.writeText(sub.subscription_url).then(() => {
      setCopiedId(sub.id)
      toast.success(t('subscriptions.copySuccess'))
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  // 统计数字卡片配置
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
  const staleProviderCount = stats?.providers?.filter((provider) => provider.cache_stale || provider.fetch_error).length ?? 0
  const expiringSubscriptionCount = stats?.subscriptions?.filter((sub) => sub.token_expired).length ?? 0
  const isSystemHealthy = staleProviderCount === 0 && expiringSubscriptionCount === 0

  const operationHighlights = [
    {
      key: 'providers',
      label: t('dashboard.providerStatus'),
      value: stats?.providers?.length ?? 0,
      meta:
        staleProviderCount > 0
          ? t('dashboard.providerAttention', { count: staleProviderCount })
          : t('dashboard.providerAllGood'),
      status: staleProviderCount > 0 ? 'warning' : 'success',
    },
    {
      key: 'subscriptions',
      label: t('dashboard.subscriptionHealth'),
      value: stats?.subscriptions?.length ?? 0,
      meta:
        expiringSubscriptionCount > 0
          ? t('dashboard.subscriptionAttention', { count: expiringSubscriptionCount })
          : t('dashboard.subscriptionAllGood'),
      status: expiringSubscriptionCount > 0 ? 'warning' : 'success',
    },
    {
      key: 'logs',
      label: t('dashboard.recentActivity'),
      value: recentLogs.length,
      meta: t('dashboard.recentActivitySummary', {
        allowed: recentAllowedCount,
        denied: recentDeniedCount,
      }),
      status: recentDeniedCount > 0 ? 'warning' : 'success',
    },
  ]

  // 渲染 provider 缓存状态 Badge
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

  // 渲染 token 过期状态 Badge
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

  // 格式化访问日志时间
  const formatLogTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return t('dashboard.relativeJustNow')
    if (diffMin < 60) return t('dashboard.relativeMinutesAgo', { count: diffMin })
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return t('dashboard.relativeHoursAgo', { count: diffH })
    return date.toLocaleString()
  }

  const getLogLocation = (log: AccessLog) => {
    const location = [log.country, log.city].filter(Boolean).join(' / ')
    return location || t('dashboard.unknownLocation')
  }

  return (
    <div className="space-y-6">
      {/* 顶部操作区 */}
      <section className="rounded-2xl border bg-card/70 p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">{t('dashboard.title')}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={isSystemHealthy ? 'success' : 'warning'}
                className="gap-1.5 px-2 py-1 text-xs"
              >
                {isSystemHealthy ? (
                  <ShieldCheck className="h-3.5 w-3.5" />
                ) : (
                  <ShieldAlert className="h-3.5 w-3.5" />
                )}
                {isSystemHealthy ? t('dashboard.systemHealthy') : t('dashboard.systemNeedsAttention')}
              </Badge>
              <span className="text-xs text-muted-foreground">{t('dashboard.operatorConsole')}</span>
            </div>
          </div>
          <Button
            onClick={() => refreshAllMutation.mutate()}
            disabled={refreshAllMutation.isPending}
            className="w-fit gap-2 shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${refreshAllMutation.isPending ? 'animate-spin' : ''}`} />
            {t('dashboard.refreshAll')}
          </Button>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {operationHighlights.map((item) => (
            <div
              key={item.key}
              className="rounded-xl border bg-background/60 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{isLoading ? '-' : item.value}</p>
                </div>
                <span
                  className={`mt-1 h-2.5 w-2.5 rounded-full ${
                    item.status === 'success' ? 'bg-green-500' : 'bg-yellow-500'
                  }`}
                />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{isLoading ? t('common.loading') : item.meta}</p>
            </div>
          ))}
        </div>
      </section>

      {showOnboardingGuide && (
        <Card className="border-primary/20 bg-muted/20">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">{t('onboarding.dashboardTitle')}</CardTitle>
                  <Badge variant={hasMissingOnboardingStep ? 'outline' : 'success'} className="text-xs">
                    {t('onboarding.progress', {
                      done: completedOnboardingSteps,
                      total: onboardingSteps.length,
                    })}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{t('onboarding.dashboardDescription')}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-fit gap-1"
                onClick={() => setOnboardingOpen((open) => !(open ?? hasMissingOnboardingStep))}
              >
                {isOnboardingOpen ? t('onboarding.collapse') : t('onboarding.expand')}
                <ChevronDown className={`h-4 w-4 transition-transform ${isOnboardingOpen ? 'rotate-180' : ''}`} />
              </Button>
            </div>
          </CardHeader>
          {isOnboardingOpen && (
            <CardContent>
              <div className="grid gap-3 md:grid-cols-3">
                {onboardingSteps.map((step, index) => (
                  <button
                    key={step.path}
                    type="button"
                    onClick={() => navigate(step.path)}
                    className="rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={step.done ? 'success' : 'outline'} className="h-5 px-1.5 text-xs">
                            {step.done ? t('onboarding.done') : index + 1}
                          </Badge>
                          <p className="text-sm font-medium">{step.title}</p>
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground">{step.description}</p>
                      </div>
                      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* 核心资源指标 */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <button
              key={card.key}
              type="button"
              className="group rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
              onClick={() => navigate(card.path)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-muted-foreground">{card.title}</p>
                  {isLoading ? (
                    <Skeleton className="mt-3 h-8 w-14" />
                  ) : (
                    <p className="mt-2 text-3xl font-bold tracking-tight">{card.value}</p>
                  )}
                </div>
                <div className={`rounded-lg p-2 transition-transform group-hover:scale-105 ${card.bg}`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* 两列布局：左列 Provider 状态，右列订阅健康 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 左列：订阅源状态 */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/20 pb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Server className="h-4 w-4 text-muted-foreground" />
                  {t('dashboard.providerStatus')}
                </CardTitle>
                <CardDescription>{t('dashboard.providerStatusDescription')}</CardDescription>
              </div>
              <Badge variant={staleProviderCount > 0 ? 'warning' : 'success'} className="shrink-0">
                {staleProviderCount > 0
                  ? t('dashboard.needAttention', { count: staleProviderCount })
                  : t('dashboard.allClear')}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))
            ) : !stats?.providers?.length ? (
              <p className="text-center text-sm text-muted-foreground py-6">{t('common.noData')}</p>
            ) : (
              stats.providers.map((provider: ProviderStatus) => (
                <div
                  key={provider.id}
                  className="rounded-xl border bg-background/70 p-3 transition-colors hover:bg-muted/30"
                >
                  {/* 名称 + 缓存状态 Badge + 刷新按钮 */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          provider.cache_stale || provider.fetch_error ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                      />
                      <span className="font-semibold truncate text-sm">{provider.name}</span>
                      {renderCacheBadge(provider)}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 shrink-0"
                      disabled={refreshingIds.has(provider.id)}
                      onClick={() => handleRefreshProvider(provider.id)}
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${refreshingIds.has(provider.id) ? 'animate-spin' : ''}`}
                      />
                    </Button>
                  </div>

                  {/* 最后刷新时间 */}
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>
                      {t('dashboard.lastFetched')}：
                      {provider.last_fetched_at
                        ? new Date(provider.last_fetched_at).toLocaleString()
                        : t('dashboard.neverFetched')}
                    </span>
                  </div>

                  {/* 错误提示 */}
                  {provider.fetch_error && (
                    <div className="flex items-start gap-1 text-xs text-destructive">
                      <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                      <span className="break-all">{provider.fetch_error}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* 右列：订阅健康 */}
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/20 pb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wifi className="h-4 w-4 text-muted-foreground" />
                  {t('dashboard.subscriptionHealth')}
                </CardTitle>
                <CardDescription>{t('dashboard.subscriptionHealthDescription')}</CardDescription>
              </div>
              <Badge variant={expiringSubscriptionCount > 0 ? 'warning' : 'success'} className="shrink-0">
                {expiringSubscriptionCount > 0
                  ? t('dashboard.needAttention', { count: expiringSubscriptionCount })
                  : t('dashboard.allClear')}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))
            ) : !stats?.subscriptions?.length ? (
              <p className="text-center text-sm text-muted-foreground py-6">{t('common.noData')}</p>
            ) : (
              stats.subscriptions.map((sub: SubscriptionHealth) => (
                <div
                  key={sub.id}
                  className="rounded-xl border bg-background/70 p-3 transition-colors hover:bg-muted/30"
                >
                  {/* 名称 + Token 状态 Badge */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          sub.token_expired ? 'bg-destructive' : 'bg-green-500'
                        }`}
                      />
                      <span className="font-semibold truncate text-sm">{sub.name}</span>
                      {renderTokenBadge(sub)}
                    </div>
                    {/* 复制订阅链接按钮 */}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 shrink-0"
                      onClick={() => handleCopyLink(sub)}
                    >
                      {copiedId === sub.id ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>

                  {/* 自定义配置 / 配置模板状态 Badge */}
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    <Badge
                      variant={sub.has_custom_config ? 'secondary' : 'outline'}
                      className="text-xs"
                    >
                      {sub.has_custom_config
                        ? t('dashboard.hasCustomConfig')
                        : t('dashboard.noCustomConfig')}
                    </Badge>
                    <Badge
                      variant={sub.has_config_template ? 'secondary' : 'outline'}
                      className="text-xs"
                    >
                      {sub.has_config_template
                        ? t('dashboard.hasConfigTemplate')
                        : t('dashboard.noConfigTemplate')}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* 最近访问日志（活动流样式） */}
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/20">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-4 w-4 text-muted-foreground" />
                {t('dashboard.recentLogs')}
              </CardTitle>
              <CardDescription>{t('dashboard.recentLogsDescription')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="success" className="gap-1 text-xs">
                <CheckCircle2 className="h-3 w-3" />
                {t('dashboard.allowedCount', { count: recentAllowedCount })}
              </Badge>
              <Badge variant={recentDeniedCount > 0 ? 'destructive' : 'outline'} className="gap-1 text-xs">
                <XCircle className="h-3 w-3" />
                {t('dashboard.deniedCount', { count: recentDeniedCount })}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : !stats?.recent_access_logs?.length ? (
            <div className="rounded-xl border border-dashed py-10 text-center">
              <Activity className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-medium">{t('dashboard.noRecentLogsTitle')}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t('dashboard.noRecentLogsDescription')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentLogs.map((log: AccessLog) => (
                <article
                  key={log.id}
                  className={`rounded-xl border p-4 transition-colors ${
                    log.allowed
                      ? 'bg-background/70 hover:bg-green-500/5'
                      : 'border-destructive/30 bg-destructive/5 hover:bg-destructive/10'
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <div
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                          log.allowed
                            ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200'
                            : 'bg-destructive/15 text-destructive'
                        }`}
                      >
                        {log.allowed ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-semibold">{log.ip}</span>
                          <Badge variant={log.allowed ? 'success' : 'destructive'} className="h-5 gap-1 text-xs">
                            {log.allowed ? t('accessLogs.allowedBadge') : t('accessLogs.deniedBadge')}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {log.allowed
                            ? t('dashboard.accessAllowedDescription')
                            : t('dashboard.accessDeniedDescription')}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {getLogLocation(log)}
                          </span>
                          {log.deny_reason && (
                            <span className="inline-flex items-center gap-1 text-destructive">
                              <AlertCircle className="h-3 w-3" />
                              {log.deny_reason}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <time className="shrink-0 text-xs text-muted-foreground" dateTime={log.created_at}>
                      {formatLogTime(log.created_at)}
                    </time>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
