import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, RefreshCw, AlertCircle } from 'lucide-react'
import { providersApi } from '@/api/providers'
import { userAgentsApi } from '@/api/user-agents'
import type { Provider } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ProviderFormData {
  name: string
  url: string
  user_agent_id: string
  cache_ttl: string
}

export function Providers() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null)
  const [deletingProvider, setDeletingProvider] = useState<Provider | null>(null)
  const [refreshingId, setRefreshingId] = useState<number | null>(null)
  const [formData, setFormData] = useState<ProviderFormData>({
    name: '',
    url: '',
    user_agent_id: '',
    cache_ttl: '3600',
  })
  const [formErrors, setFormErrors] = useState<Partial<ProviderFormData>>({})

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: providersApi.list,
  })

  const { data: userAgents = [] } = useQuery({
    queryKey: ['user-agents'],
    queryFn: userAgentsApi.list,
  })

  const createMutation = useMutation({
    mutationFn: providersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] })
      toast.success(t('common.success'))
      setDialogOpen(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ReturnType<typeof buildPayload> }) =>
      providersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] })
      toast.success(t('common.success'))
      setDialogOpen(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: providersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] })
      toast.success(t('common.success'))
      setDeleteDialogOpen(false)
    },
  })

  const buildPayload = (data: ProviderFormData) => ({
    name: data.name,
    url: data.url,
    user_agent_id: data.user_agent_id ? Number(data.user_agent_id) : undefined,
    cache_ttl: Number(data.cache_ttl) || 0,
  })

  const handleRefresh = async (provider: Provider) => {
    setRefreshingId(provider.id)
    try {
      await providersApi.refresh(provider.id)
      queryClient.invalidateQueries({ queryKey: ['providers'] })
      toast.success(t('providers.refreshSuccess'))
    } catch {
      toast.error(t('providers.refreshFailed'))
    } finally {
      setRefreshingId(null)
    }
  }

  const openCreateDialog = () => {
    setEditingProvider(null)
    setFormData({ name: '', url: '', user_agent_id: '', cache_ttl: '3600' })
    setFormErrors({})
    setDialogOpen(true)
  }

  const openEditDialog = (p: Provider) => {
    setEditingProvider(p)
    setFormData({
      name: p.name,
      url: p.url,
      user_agent_id: p.user_agent_id ? String(p.user_agent_id) : '',
      cache_ttl: String(p.cache_ttl),
    })
    setFormErrors({})
    setDialogOpen(true)
  }

  const validateForm = () => {
    const errors: Partial<ProviderFormData> = {}
    if (!formData.name.trim()) errors.name = t('common.required')
    if (!formData.url.trim()) errors.url = t('common.required')
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = () => {
    if (!validateForm()) return
    const payload = buildPayload(formData)
    if (editingProvider) {
      updateMutation.mutate({ id: editingProvider.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('providers.title')}</h1>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          {t('providers.addProvider')}
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common.name')}</TableHead>
              <TableHead>{t('providers.providerUrl')}</TableHead>
              <TableHead>{t('providers.userAgent')}</TableHead>
              <TableHead>{t('providers.lastFetched')}</TableHead>
              <TableHead className="w-[130px]">{t('common.actions')}</TableHead>
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
            ) : providers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  {t('common.noData')}
                </TableCell>
              </TableRow>
            ) : (
              providers.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="font-mono text-xs truncate max-w-[200px] block cursor-default">
                            {p.url}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs break-all">{p.url}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>
                    {p.user_agent?.name ? (
                      <Badge variant="secondary">{p.user_agent.name}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {p.fetch_error ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1 text-destructive">
                              <AlertCircle className="h-4 w-4" />
                              <span className="text-xs">{t('providers.fetchError')}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs break-all">{p.fetch_error}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : p.last_fetched_at ? (
                      <span className="text-sm text-muted-foreground">
                        {new Date(p.last_fetched_at).toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {t('providers.neverFetched')}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRefresh(p)}
                        disabled={refreshingId === p.id}
                        title={t('common.refresh')}
                      >
                        <RefreshCw
                          className={`h-4 w-4 ${refreshingId === p.id ? 'animate-spin' : ''}`}
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(p)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => { setDeletingProvider(p); setDeleteDialogOpen(true) }}
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

      {/* 创建/编辑 Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              handleSubmit()
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {editingProvider ? t('providers.editProvider') : t('providers.addProvider')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>{t('providers.providerName')}</Label>
                <Input
                  placeholder={t('providers.namePlaceholder')}
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                />
                {formErrors.name && <p className="text-sm text-destructive">{formErrors.name}</p>}
              </div>

              <div className="space-y-2">
                <Label>{t('providers.providerUrl')}</Label>
                <Input
                  placeholder={t('providers.urlPlaceholder')}
                  value={formData.url}
                  onChange={(e) => setFormData((p) => ({ ...p, url: e.target.value }))}
                />
                {formErrors.url && <p className="text-sm text-destructive">{formErrors.url}</p>}
              </div>

              <div className="space-y-2">
                <Label>{t('providers.userAgent')}</Label>
                <Select
                  value={formData.user_agent_id || '__none__'}
                  onValueChange={(v) => setFormData((p) => ({ ...p, user_agent_id: v === '__none__' ? '' : v }))}
                >
                  <SelectTrigger type="button">
                    <SelectValue placeholder={t('providers.selectUA')} />
                  </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t('providers.noUA')}</SelectItem>
                  {userAgents.map((ua) => (
                    <SelectItem key={ua.id} value={String(ua.id)}>
                      {ua.name}
                    </SelectItem>
                  ))}
                </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('providers.cacheTTL')}</Label>
                <Input
                  type="number"
                  placeholder={t('providers.cacheTTLPlaceholder')}
                  value={formData.cache_ttl}
                  onChange={(e) => setFormData((p) => ({ ...p, cache_ttl: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? t('common.saving') : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 删除确认 Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('providers.deleteProvider')}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            {t('providers.deleteConfirm')}
            {deletingProvider && (
              <span className="font-medium text-foreground"> "{deletingProvider.name}"</span>
            )}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingProvider && deleteMutation.mutate(deletingProvider.id)}
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
