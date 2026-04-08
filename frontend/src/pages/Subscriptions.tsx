import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Settings, Trash2 } from 'lucide-react'
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

export function Subscriptions() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingSubscription, setDeletingSubscription] = useState<Subscription | null>(null)
  const [newName, setNewName] = useState('')
  const [nameError, setNameError] = useState('')

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: subscriptionsApi.list,
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

  // Token 显示：仅显示前 8 位
  const maskToken = (token: string) => `${token.slice(0, 8)}...`

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
              <TableHead>{t('subscriptions.token')}</TableHead>
              <TableHead>{t('subscriptions.tokenExpiredAt')}</TableHead>
              <TableHead>{t('common.createdAt')}</TableHead>
              <TableHead className="w-[100px]">{t('common.actions')}</TableHead>
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
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  {t('common.noData')}
                </TableCell>
              </TableRow>
            ) : (
              subscriptions.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="font-medium">{sub.name}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                      {maskToken(sub.token)}
                    </code>
                  </TableCell>
                  <TableCell>
                    {sub.token_expired_at ? (
                      <Badge
                        variant={new Date(sub.token_expired_at) < new Date() ? 'destructive' : 'secondary'}
                      >
                        {new Date(sub.token_expired_at).toLocaleDateString()}
                      </Badge>
                    ) : (
                      <Badge variant="outline">{t('subscriptions.tokenNeverExpires')}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(sub.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/subscriptions/${sub.id}`)}
                        title={t('common.detail')}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDeleteDialog(sub)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 创建订阅 Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
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
              创建后可在详情页配置代理源、规则集等。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? t('common.submitting') : t('common.create')}
            </Button>
          </DialogFooter>
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
    </div>
  )
}
