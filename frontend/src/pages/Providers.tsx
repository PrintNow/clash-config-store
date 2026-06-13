import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, RefreshCw, AlertCircle, Server } from 'lucide-react'
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
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ProxyNodeForm } from '@/components/proxy/ProxyNodeForm'

// ─── 节点管理 Dialog ───────────────────────────────────────────────────────────

interface InlineProviderNodesDialogProps {
  provider: Provider
  open: boolean
  onClose: () => void
}

function InlineProviderNodesDialog({ provider, open, onClose }: InlineProviderNodesDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [nodeFormOpen, setNodeFormOpen] = useState(false)
  const [editingNodeIndex, setEditingNodeIndex] = useState<number | null>(null)
  const [deleteNodeIndex, setDeleteNodeIndex] = useState<number | null>(null)
  const [deleteNodeDialogOpen, setDeleteNodeDialogOpen] = useState(false)

  const { data: nodes = [], isLoading } = useQuery({
    queryKey: ['provider-nodes', provider.id],
    queryFn: () => providersApi.getNodes(provider.id),
    enabled: open,
  })

  const addNodeMutation = useMutation({
    mutationFn: (node: Record<string, unknown>) => providersApi.addNode(provider.id, node),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-nodes', provider.id] })
      queryClient.invalidateQueries({ queryKey: ['providers'] })
      toast.success(t('common.success'))
      setNodeFormOpen(false)
    },
    onError: () => toast.error(t('common.error')),
  })

  const updateNodeMutation = useMutation({
    mutationFn: ({ index, node }: { index: number; node: Record<string, unknown> }) =>
      providersApi.updateNode(provider.id, index, node),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-nodes', provider.id] })
      queryClient.invalidateQueries({ queryKey: ['providers'] })
      toast.success(t('common.success'))
      setNodeFormOpen(false)
      setEditingNodeIndex(null)
    },
    onError: () => toast.error(t('common.error')),
  })

  const deleteNodeMutation = useMutation({
    mutationFn: (index: number) => providersApi.deleteNode(provider.id, index),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-nodes', provider.id] })
      queryClient.invalidateQueries({ queryKey: ['providers'] })
      toast.success(t('common.success'))
      setDeleteNodeDialogOpen(false)
      setDeleteNodeIndex(null)
    },
    onError: () => toast.error(t('common.error')),
  })

  const handleSaveNode = (node: Record<string, unknown>) => {
    if (editingNodeIndex !== null) {
      updateNodeMutation.mutate({ index: editingNodeIndex, node })
    } else {
      addNodeMutation.mutate(node)
    }
  }

  const openAddNode = () => {
    setEditingNodeIndex(null)
    setNodeFormOpen(true)
  }

  const openEditNode = (idx: number) => {
    setEditingNodeIndex(idx)
    setNodeFormOpen(true)
  }

  const openDeleteNode = (idx: number) => {
    setDeleteNodeIndex(idx)
    setDeleteNodeDialogOpen(true)
  }

  const editingNode = editingNodeIndex !== null ? nodes[editingNodeIndex] : undefined

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t('providers.editNodes')} — {provider.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="flex justify-end">
              <Button size="sm" onClick={openAddNode}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t('providers.addNode')}
              </Button>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : nodes.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm border rounded-lg">
                {t('common.noData')}
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('common.name')}</TableHead>
                      <TableHead>{t('common.type')}</TableHead>
                      <TableHead>Server:Port</TableHead>
                      <TableHead className="w-[80px]">{t('common.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nodes.map((node, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">
                          {String(node.name ?? '-')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{String(node.type ?? '-')}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {node.server ? `${String(node.server)}:${String(node.port ?? '')}` : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => openEditNode(idx)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => openDeleteNode(idx)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>{t('common.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 节点表单弹窗 */}
      <Dialog open={nodeFormOpen} onOpenChange={(o) => { if (!o) { setNodeFormOpen(false); setEditingNodeIndex(null) } }}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingNodeIndex !== null ? t('providers.editNode') : t('providers.addNode')}
            </DialogTitle>
          </DialogHeader>
          <ProxyNodeForm
            initialValue={editingNode}
            onSave={handleSaveNode}
            onCancel={() => { setNodeFormOpen(false); setEditingNodeIndex(null) }}
          />
        </DialogContent>
      </Dialog>

      {/* 删除节点确认 */}
      <Dialog open={deleteNodeDialogOpen} onOpenChange={setDeleteNodeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('common.delete')}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">确认删除该节点吗？</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteNodeDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteNodeIndex !== null && deleteNodeMutation.mutate(deleteNodeIndex)}
              disabled={deleteNodeMutation.isPending}
            >
              {deleteNodeMutation.isPending ? t('common.submitting') : t('common.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── 主页面 ────────────────────────────────────────────────────────────────────

interface HttpProviderFormData {
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
  const [nodesDialogProvider, setNodesDialogProvider] = useState<Provider | null>(null)
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null)
  const [deletingProvider, setDeletingProvider] = useState<Provider | null>(null)
  const [refreshingId, setRefreshingId] = useState<number | null>(null)

  // 新建时选择类型
  const [selectedType, setSelectedType] = useState<'http' | 'inline'>('http')

  const [httpForm, setHttpForm] = useState<HttpProviderFormData>({
    name: '',
    url: '',
    user_agent_id: '',
    cache_ttl: '3600',
  })
  const [inlineName, setInlineName] = useState('')
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

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
    onError: () => toast.error(t('common.error')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof providersApi.update>[1] }) =>
      providersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] })
      toast.success(t('common.success'))
      setDialogOpen(false)
    },
    onError: () => toast.error(t('common.error')),
  })

  const deleteMutation = useMutation({
    mutationFn: providersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] })
      toast.success(t('common.success'))
      setDeleteDialogOpen(false)
    },
    onError: () => toast.error(t('common.error')),
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
    setSelectedType('http')
    setHttpForm({ name: '', url: '', user_agent_id: '', cache_ttl: '3600' })
    setInlineName('')
    setFormErrors({})
    setDialogOpen(true)
  }

  const openEditDialog = (p: Provider) => {
    setEditingProvider(p)
    if (p.type === 'inline') {
      setSelectedType('inline')
      setInlineName(p.name)
    } else {
      setSelectedType('http')
      setHttpForm({
        name: p.name,
        url: p.url ?? '',
        user_agent_id: p.user_agent_id ? String(p.user_agent_id) : '',
        cache_ttl: String(p.cache_ttl),
      })
    }
    setFormErrors({})
    setDialogOpen(true)
  }

  const validateForm = () => {
    const errors: Record<string, string> = {}
    const currentType = editingProvider ? editingProvider.type : selectedType
    if (currentType === 'http') {
      if (!httpForm.name.trim()) errors.name = t('common.required')
      if (!httpForm.url.trim()) errors.url = t('common.required')
    } else {
      if (!inlineName.trim()) errors.name = t('common.required')
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = () => {
    if (!validateForm()) return
    const currentType = editingProvider ? editingProvider.type : selectedType

    if (currentType === 'http') {
      const payload = {
        name: httpForm.name,
        type: 'http' as const,
        url: httpForm.url,
        user_agent_id: httpForm.user_agent_id ? Number(httpForm.user_agent_id) : undefined,
        cache_ttl: Number(httpForm.cache_ttl) || 0,
      }
      if (editingProvider) {
        updateMutation.mutate({ id: editingProvider.id, data: payload })
      } else {
        createMutation.mutate(payload)
      }
    } else {
      const payload = {
        name: inlineName,
        type: 'inline' as const,
      }
      if (editingProvider) {
        updateMutation.mutate({ id: editingProvider.id, data: payload })
      } else {
        createMutation.mutate(payload)
      }
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending
  const currentEditType = editingProvider ? editingProvider.type : selectedType

  const renderProviderTypeBadge = (p: Provider) => {
    if (p.type === 'inline') {
      return (
        <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200">
          {t('providers.typeInline')}
        </Badge>
      )
    }
    return (
      <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200">
        {t('providers.typeHttp')}
      </Badge>
    )
  }

  const renderInlineNodeTags = (p: Provider) => {
    const nodes = p.payload ?? []
    if (nodes.length === 0) {
      return <span className="text-muted-foreground text-sm">0 个节点</span>
    }
    const names = nodes.map((n) => String(n.name ?? '?'))
    const shown = names.slice(0, 3)
    const extra = names.length - 3
    return (
      <div className="flex flex-wrap gap-1">
        {shown.map((n, i) => (
          <Badge key={i} variant="secondary" className="text-xs">{n}</Badge>
        ))}
        {extra > 0 && (
          <Badge variant="outline" className="text-xs">+{extra}</Badge>
        )}
      </div>
    )
  }

  const renderActionButtons = (p: Provider) => (
    <div className="flex items-center gap-1">
      {p.type === 'inline' ? (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setNodesDialogProvider(p)}
          title={t('providers.editNodes')}
        >
          <Server className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => handleRefresh(p)}
          disabled={refreshingId === p.id}
          title={t('common.refresh')}
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshingId === p.id ? 'animate-spin' : ''}`}
          />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => openEditDialog(p)}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:text-destructive"
        onClick={() => { setDeletingProvider(p); setDeleteDialogOpen(true) }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* 标题区 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('providers.title')}</h1>
        <Button size="sm" onClick={openCreateDialog}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('providers.addProvider')}
        </Button>
      </div>

      {/* 桌面端表格 */}
      <div className="hidden sm:block rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common.name')}</TableHead>
              <TableHead>{t('common.type')}</TableHead>
              <TableHead>{t('providers.providerUrl')}</TableHead>
              <TableHead>{t('providers.lastFetched')}</TableHead>
              <TableHead className="w-[120px]">{t('common.actions')}</TableHead>
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
                <TableCell colSpan={5}>
                  <EmptyState
                    title={t('providers.emptyTitle')}
                    description={t('providers.emptyDescription')}
                    actions={(
                      <Button size="sm" onClick={openCreateDialog}>
                        <Plus className="mr-1.5 h-4 w-4" />
                        {t('providers.addProvider')}
                      </Button>
                    )}
                  />
                </TableCell>
              </TableRow>
            ) : (
              providers.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{renderProviderTypeBadge(p)}</TableCell>
                  <TableCell>
                    {p.type === 'inline' ? (
                      renderInlineNodeTags(p)
                    ) : (
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
                    )}
                  </TableCell>
                  <TableCell>
                    {p.type === 'inline' ? (
                      <span className="text-muted-foreground text-sm">
                        {t('providers.inlineNodes')}
                      </span>
                    ) : p.fetch_error ? (
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
                    {renderActionButtons(p)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 移动端卡片列表 */}
      <div className="block sm:hidden space-y-2">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-3 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardContent>
            </Card>
          ))
        ) : providers.length === 0 ? (
          <EmptyState
            title={t('providers.emptyTitle')}
            description={t('providers.emptyDescription')}
            actions={(
              <Button size="sm" onClick={openCreateDialog}>
                <Plus className="mr-1.5 h-4 w-4" />
                {t('providers.addProvider')}
              </Button>
            )}
          />
        ) : (
          providers.map((p) => (
            <Card key={p.id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{p.name}</span>
                      {renderProviderTypeBadge(p)}
                    </div>
                    {p.type === 'inline' ? (
                      renderInlineNodeTags(p)
                    ) : (
                      <p className="font-mono text-xs text-muted-foreground truncate">{p.url}</p>
                    )}
                    {p.type === 'http' && (
                      <div className="text-xs text-muted-foreground">
                        {p.fetch_error ? (
                          <span className="text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {t('providers.fetchError')}
                          </span>
                        ) : p.last_fetched_at ? (
                          new Date(p.last_fetched_at).toLocaleString()
                        ) : (
                          t('providers.neverFetched')
                        )}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0">
                    {renderActionButtons(p)}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* 创建/编辑 Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => { e.preventDefault(); handleSubmit() }}
          >
            <DialogHeader>
              <DialogTitle>
                {editingProvider ? t('providers.editProvider') : t('providers.addProvider')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* 类型选择（仅新建时显示） */}
              {!editingProvider && (
                <div className="space-y-2">
                  <Label>{t('providers.selectType')}</Label>
                  <NativeSelect
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value as 'http' | 'inline')}
                  >
                    <NativeSelectOption value="http">{t('providers.typeHttp')}</NativeSelectOption>
                    <NativeSelectOption value="inline">{t('providers.typeInline')}</NativeSelectOption>
                  </NativeSelect>
                </div>
              )}

              {/* HTTP 类型字段 */}
              {currentEditType === 'http' && (
                <>
                  <div className="space-y-2">
                    <Label>{t('providers.providerName')}</Label>
                    <Input
                      placeholder={t('providers.namePlaceholder')}
                      value={httpForm.name}
                      onChange={(e) => setHttpForm((p) => ({ ...p, name: e.target.value }))}
                    />
                    {formErrors.name && <p className="text-sm text-destructive">{formErrors.name}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>{t('providers.providerUrl')}</Label>
                    <Input
                      placeholder={t('providers.urlPlaceholder')}
                      value={httpForm.url}
                      onChange={(e) => setHttpForm((p) => ({ ...p, url: e.target.value }))}
                    />
                    {formErrors.url && <p className="text-sm text-destructive">{formErrors.url}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>{t('providers.userAgent')}</Label>
                    <NativeSelect
                      value={httpForm.user_agent_id || '__none__'}
                      onChange={(e) => {
                        const v = e.target.value
                        setHttpForm((p) => ({ ...p, user_agent_id: v === '__none__' ? '' : v }))
                      }}
                    >
                      <NativeSelectOption value="__none__">{t('providers.noUA')}</NativeSelectOption>
                      {userAgents.map((ua) => (
                        <NativeSelectOption key={ua.id} value={String(ua.id)}>
                          {ua.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </div>
                  <div className="space-y-2">
                    <Label>{t('providers.cacheTTL')}</Label>
                    <Input
                      type="number"
                      placeholder={t('providers.cacheTTLPlaceholder')}
                      value={httpForm.cache_ttl}
                      onChange={(e) => setHttpForm((p) => ({ ...p, cache_ttl: e.target.value }))}
                    />
                  </div>
                </>
              )}

              {/* Inline 类型字段 */}
              {currentEditType === 'inline' && (
                <div className="space-y-2">
                  <Label>{t('providers.providerName')}</Label>
                  <Input
                    placeholder={t('providers.namePlaceholder')}
                    value={inlineName}
                    onChange={(e) => setInlineName(e.target.value)}
                  />
                  {formErrors.name && <p className="text-sm text-destructive">{formErrors.name}</p>}
                  <p className="text-xs text-muted-foreground">
                    创建后，通过"编辑节点"按钮管理节点列表。
                  </p>
                </div>
              )}
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

      {/* Inline 节点管理 Dialog */}
      {nodesDialogProvider && (
        <InlineProviderNodesDialog
          provider={nodesDialogProvider}
          open={!!nodesDialogProvider}
          onClose={() => setNodesDialogProvider(null)}
        />
      )}
    </div>
  )
}
