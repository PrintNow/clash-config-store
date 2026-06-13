import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { CalendarClock, Check, Copy, Plus, QrCode, Server, Settings, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { subscriptionsApi } from '@/api/subscriptions'
import type { Subscription, SubscriptionComponents } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import { SubscriptionShareDialog } from '@/components/subscriptions/SubscriptionShareDialog'
import { subscriptionPublicUrl } from '@/lib/subscription-url'

function SubscriptionComponentsPanel({ subscriptionId }: { subscriptionId: number }) {
  const { t } = useTranslation()

  const { data: components, isLoading } = useQuery<SubscriptionComponents>({
    queryKey: ['subscription-components', subscriptionId],
    queryFn: () => subscriptionsApi.getComponents(subscriptionId),
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground mb-2">{t('subscriptions.components')}</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{t('subscriptions.componentProviders')}</p>
          {!components || components.providers.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('subscriptions.componentsNoProviders')}</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {components.providers.map((p) => (
                <Badge key={p.id} variant="secondary" className="text-xs">{p.name}</Badge>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{t('subscriptions.componentConfig')}</p>
          {!components || !components.custom_config ? (
            <p className="text-xs text-muted-foreground">{t('subscriptions.componentsNoConfig')}</p>
          ) : (
            <Badge variant="outline" className="text-xs">{components.custom_config.name}</Badge>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{t('subscriptions.componentRuleSets')}</p>
          {!components || components.rule_sets.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('common.noData')}</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {components.rule_sets.slice(0, 5).map((rs) => (
                <Badge key={rs.id} variant="outline" className="text-xs">{rs.name}</Badge>
              ))}
              {components.rule_sets.length > 5 && (
                <Badge variant="outline" className="text-xs">+{components.rule_sets.length - 5}</Badge>
              )}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{t('subscriptions.componentTemplate')}</p>
          {!components || !components.template ? (
            <p className="text-xs text-muted-foreground">{t('subscriptions.componentsNoTemplate')}</p>
          ) : (
            <Badge variant="outline" className="text-xs">{components.template.name}</Badge>
          )}
        </div>
      </div>
    </div>
  )
}

export function Subscriptions() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingSubscription, setDeletingSubscription] = useState<Subscription | null>(null)
  const [shareSubscription, setShareSubscription] = useState<Subscription | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [newName, setNewName] = useState('')
  const [nameError, setNameError] = useState('')
  const [expandedComponents, setExpandedComponents] = useState<number | null>(null)

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: subscriptionsApi.list,
    staleTime: 0,
  })

  const createMutation = useMutation({
    mutationFn: subscriptionsApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      toast.success(t('common.success'))
      setCreateDialogOpen(false)
      navigate(`/subscriptions/${data.id}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: subscriptionsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      toast.success(t('common.success'))
      setDeleteDialogOpen(false)
    },
  })

  const handleCreate = () => {
    if (!newName.trim()) {
      setNameError(t('common.required'))
      return
    }
    createMutation.mutate({
      name: newName,
      enabled_provider_ids: [],
      rule_insert_mode: 'append',
      proxy_prefix_enabled: false,
    })
  }

  const openDeleteDialog = (sub: Subscription) => {
    setDeletingSubscription(sub)
    setDeleteDialogOpen(true)
  }

  const markCopied = (id: number) => {
    setCopiedId(id)
    setTimeout(() => {
      setCopiedId((current) => (current === id ? null : current))
    }, 2000)
  }

  const copySubscriptionLink = async (sub: Subscription) => {
    try {
      await navigator.clipboard.writeText(subscriptionPublicUrl(sub))
      markCopied(sub.id)
      toast.success(t('subscriptions.copySuccess'))
    } catch {
      toast.error(t('common.error'))
    }
  }

  const toggleComponents = (subId: number) => {
    setExpandedComponents((prev) => (prev === subId ? null : subId))
  }

  const maskToken = (token: string) => `${token.slice(0, 8)}...`

  const formatDate = (value?: string) => {
    if (!value) return '-'
    return new Date(value).toLocaleDateString()
  }

  const formatDateTime = (value?: string) => {
    if (!value) return '-'
    return new Date(value).toLocaleString()
  }

  const getExpiryBadge = (sub: Subscription) => {
    if (!sub.token_expired_at) {
      return <Badge variant="outline">{t('subscriptions.tokenNeverExpires')}</Badge>
    }
    const expired = new Date(sub.token_expired_at) < new Date()
    return (
      <Badge variant={expired ? 'destructive' : 'secondary'}>
        {expired ? t('subscriptions.tokenExpired') : t('subscriptions.tokenExpiresSoon')}
      </Badge>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">{t('subscriptions.title')}</h1>
        <Button
          size="sm"
          onClick={() => { setNewName(''); setNameError(''); setCreateDialogOpen(true) }}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          {t('subscriptions.addSubscription')}
        </Button>
      </div>

      {/* 桌面端表格（sm+） */}
      <div className="hidden sm:block rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common.name')}</TableHead>
              <TableHead className="w-[140px]">{t('subscriptions.accessOverview')}</TableHead>
              <TableHead>{t('subscriptions.tokenExpiredAt')}</TableHead>
              <TableHead>{t('common.createdAt')}</TableHead>
              <TableHead className="w-[140px]">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : subscriptions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>
                  <EmptyState
                    title={t('subscriptions.emptyTitle')}
                    description={t('subscriptions.emptyDescription')}
                    actions={(
                      <Button
                        size="sm"
                        onClick={() => { setNewName(''); setNameError(''); setCreateDialogOpen(true) }}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        {t('subscriptions.addSubscription')}
                      </Button>
                    )}
                  />
                </TableCell>
              </TableRow>
            ) : (
              subscriptions.map((sub) => {
                const copied = copiedId === sub.id
                const isExpanded = expandedComponents === sub.id
                return (
                  <>
                    <TableRow key={sub.id}>
                      <TableCell className="align-top">
                        <div className="space-y-1.5 py-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              className="font-medium text-left underline-offset-4 hover:text-primary hover:underline"
                              onClick={() => navigate(`/subscriptions/${sub.id}`)}
                            >
                              {sub.name}
                            </button>
                            {copied && (
                              <Badge variant="secondary" className="gap-1">
                                <Check className="h-3 w-3" />
                                {t('common.copied')}
                              </Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <code className="rounded bg-muted px-1.5 py-0.5">
                              {t('subscriptions.token')}: {maskToken(sub.token)}
                            </code>
                            <span className="inline-flex items-center gap-1">
                              <Server className="h-3.5 w-3.5" />
                              {t('subscriptions.activeProviderCount', {
                                count: sub.enabled_provider_ids.length,
                              })}
                            </span>
                            <button
                              type="button"
                              className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors"
                              onClick={() => toggleComponents(sub.id)}
                            >
                              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              {t('subscriptions.components')}
                            </button>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="py-0.5">
                          <button
                            type="button"
                            className="text-left"
                            onClick={() => navigate(`/subscriptions/${sub.id}/logs`)}
                            title={t('subscriptions.viewLogs')}
                          >
                            <p className="text-xl font-semibold leading-none tabular-nums">
                              {sub.access_log_count ?? 0}
                            </p>
                            <p className="mt-1 text-xs text-primary underline-offset-4 hover:underline">
                              {t('subscriptions.viewLogs')}
                            </p>
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-1.5 py-0.5">
                          {getExpiryBadge(sub)}
                          <p className="text-xs text-muted-foreground">
                            {sub.token_expired_at
                              ? formatDateTime(sub.token_expired_at)
                              : t('subscriptions.noExpiryDescription')}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-sm text-muted-foreground">
                        <div className="space-y-0.5 py-0.5">
                          <div className="inline-flex items-center gap-1">
                            <CalendarClock className="h-3.5 w-3.5" />
                            <span>{formatDate(sub.created_at)}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex items-center gap-0.5 py-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setShareSubscription(sub)}
                            title={t('subscriptions.shareSubscriptionUrl')}
                            aria-label={t('subscriptions.shareSubscriptionUrl')}
                          >
                            <QrCode className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copySubscriptionLink(sub)}
                            title={t('subscriptions.copySubscriptionUrl')}
                            aria-label={t('subscriptions.copySubscriptionUrl')}
                          >
                            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/subscriptions/${sub.id}`)}
                            title={t('common.detail')}
                            aria-label={t('common.detail')}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteDialog(sub)}
                            className="text-destructive hover:text-destructive"
                            aria-label={t('common.delete')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {isExpanded && (
                      <TableRow key={`${sub.id}-components`}>
                        <TableCell colSpan={5} className="bg-muted/20 px-6 py-3">
                          <SubscriptionComponentsPanel subscriptionId={sub.id} />
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* 移动端卡片列表（sm以下） */}
      <div className="block sm:hidden space-y-2">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-24" />
              </CardContent>
            </Card>
          ))
        ) : subscriptions.length === 0 ? (
          <EmptyState
            title={t('subscriptions.emptyTitle')}
            description={t('subscriptions.emptyDescription')}
            actions={(
              <Button
                size="sm"
                onClick={() => { setNewName(''); setNameError(''); setCreateDialogOpen(true) }}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('subscriptions.addSubscription')}
              </Button>
            )}
          />
        ) : (
          subscriptions.map((sub) => {
            const copied = copiedId === sub.id
            const isExpanded = expandedComponents === sub.id
            return (
              <Card key={sub.id}>
                <CardContent className="p-4 space-y-3">
                  {/* 名称 + 过期状态 */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        className="font-medium text-left hover:text-primary hover:underline underline-offset-4 truncate block w-full"
                        onClick={() => navigate(`/subscriptions/${sub.id}`)}
                      >
                        {sub.name}
                      </button>
                      <div className="mt-1 flex items-center gap-2 flex-wrap">
                        {getExpiryBadge(sub)}
                        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          <Server className="h-3 w-3" />
                          {t('subscriptions.activeProviderCount', { count: sub.enabled_provider_ids.length })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 访问次数 + 创建时间 */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <button
                      type="button"
                      className="inline-flex items-baseline gap-1 hover:text-primary"
                      onClick={() => navigate(`/subscriptions/${sub.id}/logs`)}
                    >
                      <span className="text-base font-semibold tabular-nums text-foreground">
                        {sub.access_log_count ?? 0}
                      </span>
                      <span className="text-primary underline-offset-2 hover:underline">
                        {t('subscriptions.viewLogs')}
                      </span>
                    </button>
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" />
                      {formatDate(sub.created_at)}
                    </span>
                  </div>

                  {/* 组件折叠 */}
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => toggleComponents(sub.id)}
                  >
                    {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    {t('subscriptions.components')}
                  </button>

                  {isExpanded && (
                    <div className="pt-1 border-t">
                      <SubscriptionComponentsPanel subscriptionId={sub.id} />
                    </div>
                  )}

                  {/* 操作按钮行 */}
                  <div className="flex items-center gap-1 pt-1 border-t -mx-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 gap-1.5 text-xs h-8"
                      onClick={() => copySubscriptionLink(sub)}
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? t('common.copied') : t('subscriptions.copySubscriptionUrl')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 gap-1.5 text-xs h-8"
                      onClick={() => setShareSubscription(sub)}
                    >
                      <QrCode className="h-3.5 w-3.5" />
                      {t('subscriptions.shareSubscriptionUrl')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => navigate(`/subscriptions/${sub.id}`)}
                      aria-label={t('common.detail')}
                    >
                      <Settings className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => openDeleteDialog(sub)}
                      aria-label={t('common.delete')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* 创建订阅 Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              handleCreate()
            }}
          >
            <DialogHeader>
              <DialogTitle>{t('subscriptions.addSubscription')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>{t('subscriptions.subscriptionName')}</Label>
                <Input
                  placeholder={t('subscriptions.namePlaceholder')}
                  value={newName}
                  onChange={(e) => { setNewName(e.target.value); setNameError('') }}
                />
                {nameError && <p className="text-sm text-destructive">{nameError}</p>}
              </div>
              <p className="text-sm text-muted-foreground">
                {t('subscriptions.createHint')}
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? t('common.submitting') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 删除确认 Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('subscriptions.deleteSubscription')}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            {t('subscriptions.deleteConfirm')}
            {deletingSubscription && (
              <span className="font-medium text-foreground"> "{deletingSubscription.name}"</span>
            )}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deletingSubscription && deleteMutation.mutate(deletingSubscription.id)
              }
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? t('common.submitting') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SubscriptionShareDialog
        open={shareSubscription !== null}
        subscriptionName={shareSubscription?.name ?? ''}
        subscriptionUrl={shareSubscription ? subscriptionPublicUrl(shareSubscription) : ''}
        onOpenChange={(open) => {
          if (!open) {
            setShareSubscription(null)
          }
        }}
        onCopy={() => {
          if (shareSubscription) {
            copySubscriptionLink(shareSubscription)
          }
        }}
      />
    </div>
  )
}
