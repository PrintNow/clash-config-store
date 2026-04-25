import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { CalendarClock, Check, Copy, Plus, QrCode, Server, Settings, Trash2 } from 'lucide-react'
import { subscriptionsApi } from '@/api/subscriptions'
import type { Subscription } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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

  // 访问次数随 /sub 拉取变化；全局 staleTime 30s 会导致与仪表盘「最近访问」不一致，此处单独置 0
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

  // Token 显示：仅显示前 8 位
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('subscriptions.title')}</h1>
        <Button
          onClick={() => { setNewName(''); setNameError(''); setCreateDialogOpen(true) }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t('subscriptions.addSubscription')}
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common.name')}</TableHead>
              <TableHead className="w-[180px]">{t('subscriptions.accessOverview')}</TableHead>
              <TableHead>{t('subscriptions.tokenExpiredAt')}</TableHead>
              <TableHead>{t('common.createdAt')}</TableHead>
              <TableHead className="w-[160px]">{t('common.actions')}</TableHead>
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

                return (
                  <TableRow key={sub.id}>
                    <TableCell className="align-top">
                      <div className="space-y-2 py-1">
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
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="space-y-1 py-1">
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => navigate(`/subscriptions/${sub.id}/logs`)}
                          title={t('subscriptions.viewLogs')}
                        >
                          <p className="text-2xl font-semibold leading-none tabular-nums">
                            {sub.access_log_count ?? 0}
                          </p>
                          <p className="mt-1 text-xs text-primary underline-offset-4 hover:underline">
                            {t('subscriptions.viewLogs')}
                          </p>
                        </button>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="space-y-2 py-1">
                        {getExpiryBadge(sub)}
                        <p className="text-xs text-muted-foreground">
                          {sub.token_expired_at
                            ? formatDateTime(sub.token_expired_at)
                            : t('subscriptions.noExpiryDescription')}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="align-top text-sm text-muted-foreground">
                      <div className="space-y-1 py-1">
                        <div className="inline-flex items-center gap-1">
                          <CalendarClock className="h-3.5 w-3.5" />
                          <span>{formatDate(sub.created_at)}</span>
                        </div>
                        <p className="text-xs">{formatDateTime(sub.created_at)}</p>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex items-center gap-1 py-1">
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
                )
              })
            )}
          </TableBody>
        </Table>
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
