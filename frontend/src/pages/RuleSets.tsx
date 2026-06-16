import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Maximize2, Minimize2, Server, Globe, Check, Copy } from 'lucide-react'
import { ruleSetsApi } from '@/api/rule-sets'
import type { RuleSet } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import { YamlEditor } from '@/components/YamlEditor'

type TabValue = 'all' | 'external' | 'hosted'

interface RuleSetFormData {
  source_type: 'external' | 'hosted'
  name: string
  behavior: string
  format: string
  url: string
  interval: string
  content: string
}

function CacheModeDropdown({ enabled, onSelect }: { enabled: boolean; onSelect: (v: boolean) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium transition-colors hover:opacity-80 focus:outline-none
            ${enabled
              ? 'bg-primary/10 text-primary border border-primary/20'
              : 'bg-muted text-muted-foreground border border-border'}`}
        >
          {enabled
            ? <><Server className="h-3 w-3" />服务器缓存</>
            : <><Globe className="h-3 w-3" />源站直接</>}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuItem onClick={() => onSelect(true)} className="flex items-start gap-2 py-2">
          <Server className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-sm">服务器缓存</span>
              {enabled && <Check className="h-3 w-3 text-primary" />}
            </div>
            <p className="text-xs text-muted-foreground">从本服务拉取，可能有延迟</p>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSelect(false)} className="flex items-start gap-2 py-2">
          <Globe className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-sm">源站直接</span>
              {!enabled && <Check className="h-3 w-3 text-primary" />}
            </div>
            <p className="text-xs text-muted-foreground">Clash 客户端实时从源站获取</p>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function formatInterval(seconds?: number): string {
  if (!seconds) return '—'
  if (seconds >= 86400 && seconds % 86400 === 0) return `${seconds / 86400}天`
  if (seconds >= 3600 && seconds % 3600 === 0) return `${seconds / 3600}小时`
  if (seconds >= 60 && seconds % 60 === 0) return `${seconds / 60}分钟`
  return `${seconds}秒`
}

const defaultForm: RuleSetFormData = {
  source_type: 'external',
  name: '',
  behavior: 'domain',
  format: 'yaml',
  url: '',
  interval: '86400',
  content: '',
}

export function RuleSets() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') as TabValue) ?? 'all'
  const setActiveTab = (tab: TabValue) =>
    setSearchParams((prev) => { prev.set('tab', tab); return prev }, { replace: true })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogFullscreen, setDialogFullscreen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingRuleSet, setEditingRuleSet] = useState<RuleSet | null>(null)
  const [deletingRuleSet, setDeletingRuleSet] = useState<RuleSet | null>(null)
  const [formData, setFormData] = useState<RuleSetFormData>(defaultForm)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof RuleSetFormData, string>>>({})

  const { data: ruleSets = [], isLoading } = useQuery({
    queryKey: ['rule-sets'],
    queryFn: () => ruleSetsApi.list(),
  })

  const createMutation = useMutation({
    mutationFn: ruleSetsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-sets'] })
      toast.success(t('common.success'))
      setDialogOpen(false)
    },
    onError: () => toast.error(t('common.error')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof ruleSetsApi.update>[1] }) =>
      ruleSetsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-sets'] })
      toast.success(t('common.success'))
      setDialogOpen(false)
    },
    onError: () => toast.error(t('common.error')),
  })

  const cacheMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      ruleSetsApi.updateCacheMode(id, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-sets'] })
    },
    onError: () => toast.error(t('common.error')),
  })

  const deleteMutation = useMutation({
    mutationFn: ({ id, sourceType }: { id: number; sourceType: 'external' | 'hosted' }) =>
      ruleSetsApi.delete(id, sourceType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-sets'] })
      toast.success(t('common.success'))
      setDeleteDialogOpen(false)
    },
    onError: () => toast.error(t('common.error')),
  })


  const filteredRuleSets = ruleSets.filter((rs) => {
    if (activeTab === 'all') return true
    return rs.source_type === activeTab
  })

  const openCreateDialog = () => {
    setEditingRuleSet(null)
    setFormData(defaultForm)
    setFormErrors({})
    setDialogFullscreen(false)
    setDialogOpen(true)
  }

  const openEditDialog = (rs: RuleSet) => {
    setEditingRuleSet(rs)
    setDialogFullscreen(false)
    setFormData({
      source_type: rs.source_type,
      name: rs.name,
      behavior: rs.behavior,
      format: rs.format,
      url: rs.url ?? '',
      interval: String(rs.interval ?? 86400),
      content: '',
    })
    setFormErrors({})
    setDialogOpen(true)
    if (rs.source_type === 'hosted') {
      ruleSetsApi
        .get(rs.id, 'hosted')
        .then((full) => {
          setFormData((f) => ({ ...f, content: full.content ?? '' }))
        })
        .catch(() => toast.error(t('common.error')))
    }
  }

  const validateForm = () => {
    const errors: Partial<Record<keyof RuleSetFormData, string>> = {}
    if (!formData.name.trim()) errors.name = t('common.required')
    if (formData.source_type === 'external' && !formData.url.trim()) errors.url = t('common.required')
    if (formData.source_type === 'hosted' && !formData.content.trim()) errors.content = t('common.required')
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = () => {
    if (!validateForm()) return
    const payload = {
      source_type: formData.source_type,
      name: formData.name,
      behavior: formData.behavior,
      format: formData.format,
      url: formData.source_type === 'external' ? formData.url : undefined,
      interval: formData.source_type === 'external' ? Number(formData.interval) || 86400 : undefined,
      content: formData.source_type === 'hosted' ? formData.content : undefined,
    }
    if (editingRuleSet) {
      updateMutation.mutate({ id: editingRuleSet.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending

  const renderSourceTypeBadge = (rs: RuleSet) => {
    if (rs.source_type === 'external') {
      return (
        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200">
          {t('ruleSets.typeExternal')}
        </Badge>
      )
    }
    return (
      <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200">
        {t('ruleSets.typeHosted')}
      </Badge>
    )
  }

  const renderTable = (items: RuleSet[]) => {
    if (isLoading) {
      return (
        <>
          {/* 桌面端骨架 */}
          <div className="hidden sm:block rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.name')}</TableHead>
                  <TableHead>{t('common.type')}</TableHead>
                  <TableHead>Behavior</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead className="w-[100px]">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {/* 移动端骨架 */}
          <div className="block sm:hidden space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-3 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )
    }

    if (items.length === 0) {
      return (
        <EmptyState
          title={t('ruleSets.emptyTitle')}
          description={t('ruleSets.emptyDescription')}
          actions={
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="mr-1.5 h-4 w-4" />
              {t('ruleSets.addRuleSet')}
            </Button>
          }
        />
      )
    }

    return (
      <>
        {/* 桌面端表格 */}
        <div className="hidden sm:block rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[160px]">{t('common.name')}</TableHead>
                <TableHead className="w-[80px]">{t('common.type')}</TableHead>
                <TableHead>{t('ruleSets.urlColumn')}</TableHead>
                <TableHead className="w-[80px]">Behavior</TableHead>
                <TableHead className="w-[70px]">Format</TableHead>
                <TableHead className="w-[100px]">{t('ruleSets.cacheMode')}</TableHead>
                <TableHead className="w-[60px] text-center">{t('ruleSets.interval')}</TableHead>
                <TableHead className="w-[70px] text-right">{t('ruleSets.ruleCount')}</TableHead>
                <TableHead className="w-[80px]">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((rs) => (
                <TableRow key={rs.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="truncate">{rs.name}</span>
                      {rs.is_preset && (
                        <Badge className="shrink-0 text-[10px] px-1 py-0 h-4 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200">
                          预设
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{renderSourceTypeBadge(rs)}</TableCell>
                  <TableCell className="max-w-[240px]">
                    {rs.source_type === 'hosted' && rs.hrs_url ? (
                      <div className="flex items-center gap-1 min-w-0">
                        <span
                          className="block truncate text-xs text-muted-foreground font-mono flex-1"
                          title={rs.hrs_url}
                        >
                          {rs.hrs_url}
                        </span>
                        <button
                          type="button"
                          className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                          title={t('common.copy')}
                          onClick={() => {
                            navigator.clipboard.writeText(rs.hrs_url!).then(() => toast.success(t('common.copied')))
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    ) : rs.url ? (
                      <span
                        className="block truncate text-xs text-muted-foreground font-mono"
                        title={rs.url}
                      >
                        {rs.url}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{rs.behavior}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{rs.format}</Badge>
                  </TableCell>
                  <TableCell>
                    {rs.source_type === 'external' ? (
                      <CacheModeDropdown
                        enabled={rs.server_cache_enabled ?? false}
                        onSelect={(enabled) => cacheMutation.mutate({ id: rs.id, enabled })}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground tabular-nums">
                    {rs.source_type === 'external' ? formatInterval(rs.interval) : '—'}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                    {rs.rule_count ? rs.rule_count.toLocaleString() : '—'}
                  </TableCell>
                  <TableCell>
                    {!rs.is_preset && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => openEditDialog(rs)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => { setDeletingRuleSet(rs); setDeleteDialogOpen(true) }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* 移动端卡片列表 */}
        <div className="block sm:hidden space-y-2">
          {items.map((rs) => (
            <Card key={rs.id}>
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{rs.name}</span>
                      {renderSourceTypeBadge(rs)}
                      {rs.is_preset && (
                        <Badge className="text-[10px] px-1 py-0 h-4 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200">
                          预设
                        </Badge>
                      )}
                    </div>
                    {rs.source_type === 'hosted' && rs.hrs_url ? (
                      <div className="flex items-center gap-1 min-w-0">
                        <p className="text-xs text-muted-foreground font-mono truncate flex-1">{rs.hrs_url}</p>
                        <button
                          type="button"
                          className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => {
                            navigator.clipboard.writeText(rs.hrs_url!).then(() => toast.success(t('common.copied')))
                          }}
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    ) : rs.url ? (
                      <p className="text-xs text-muted-foreground font-mono truncate">{rs.url}</p>
                    ) : null}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-xs">{rs.behavior}</Badge>
                      <Badge variant="secondary" className="text-xs">{rs.format}</Badge>
                      {rs.source_type === 'external' && (
                        <span className="text-xs text-muted-foreground">{formatInterval(rs.interval)}</span>
                      )}
                      {rs.source_type === 'external' && (
                        rs.server_cache_enabled
                          ? <span className="flex items-center gap-0.5 text-xs text-primary"><Server className="h-3 w-3" />服务器缓存</span>
                          : <span className="flex items-center gap-0.5 text-xs text-muted-foreground"><Globe className="h-3 w-3" />源站直接</span>
                      )}
                      {(rs.rule_count ?? 0) > 0 && (
                        <span className="text-xs text-muted-foreground">{rs.rule_count!.toLocaleString()} 条</span>
                      )}
                    </div>
                  </div>
                  {!rs.is_preset && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(rs)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => { setDeletingRuleSet(rs); setDeleteDialogOpen(true) }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </>
    )
  }

  return (
    <div className="space-y-4">
      {/* 标题区 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('ruleSets.title')}</h1>
        <Button size="sm" onClick={openCreateDialog}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('ruleSets.addRuleSet')}
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
        <TabsList>
          <TabsTrigger value="all">
            {t('ruleSets.tabAll')}
            {ruleSets.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">{ruleSets.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="external">
            {t('ruleSets.tabExternal')}
            {ruleSets.filter((rs) => rs.source_type === 'external').length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {ruleSets.filter((rs) => rs.source_type === 'external').length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="hosted">
            {t('ruleSets.tabHosted')}
            {ruleSets.filter((rs) => rs.source_type === 'hosted').length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {ruleSets.filter((rs) => rs.source_type === 'hosted').length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-3">
          {renderTable(filteredRuleSets)}
        </TabsContent>
        <TabsContent value="external" className="mt-3">
          {renderTable(filteredRuleSets)}
        </TabsContent>
        <TabsContent value="hosted" className="mt-3">
          {renderTable(filteredRuleSets)}
        </TabsContent>
      </Tabs>

      {/* 添加/编辑弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) setDialogFullscreen(false); setDialogOpen(open) }}>
        <DialogContent
          className={dialogFullscreen
            ? 'fixed inset-2 max-w-none w-auto h-auto rounded-lg flex flex-col overflow-hidden translate-x-0 translate-y-0 top-2 left-2 right-2 bottom-2'
            : 'sm:max-w-[720px] max-h-[85vh] overflow-y-auto'
          }
          onEscapeKeyDown={(e) => {
            if (dialogFullscreen) {
              e.preventDefault()
              setDialogFullscreen(false)
            }
          }}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <form
            className={dialogFullscreen ? 'flex flex-col h-full gap-4 overflow-hidden' : 'flex flex-col gap-4'}
            onSubmit={(e) => { e.preventDefault(); handleSubmit() }}
          >
            <DialogHeader className="flex-none">
              <div className="flex items-center justify-between pr-8">
                <DialogTitle>
                  {editingRuleSet ? t('ruleSets.editRuleSet') : t('ruleSets.addRuleSet')}
                </DialogTitle>
                <button
                  type="button"
                  onClick={() => setDialogFullscreen(f => !f)}
                  className="rounded p-1 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  title={dialogFullscreen ? '退出全屏' : '全屏编辑'}
                >
                  {dialogFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
              </div>
            </DialogHeader>

            <div className={dialogFullscreen ? 'flex flex-col flex-1 space-y-4 py-2 overflow-y-auto min-h-0' : 'space-y-4 py-2'}>
              {/* source_type */}
              {!editingRuleSet && (
                <div className="space-y-2">
                  <Label>{t('common.type')}</Label>
                  <NativeSelect
                    value={formData.source_type}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        source_type: e.target.value as 'external' | 'hosted',
                      }))
                    }
                  >
                    <NativeSelectOption value="external">{t('ruleSets.tabExternal')}</NativeSelectOption>
                    <NativeSelectOption value="hosted">{t('ruleSets.tabHosted')}</NativeSelectOption>
                  </NativeSelect>
                </div>
              )}

              {/* 名称 + Behavior + Format 同行 */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>{t('common.name')}</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="my-rules"
                  />
                  {formErrors.name && <p className="text-sm text-destructive">{formErrors.name}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Behavior</Label>
                  <NativeSelect
                    value={formData.behavior}
                    onChange={(e) => setFormData((prev) => ({ ...prev, behavior: e.target.value }))}
                  >
                    <NativeSelectOption value="domain">domain</NativeSelectOption>
                    <NativeSelectOption value="ipcidr">ipcidr</NativeSelectOption>
                    <NativeSelectOption value="classical">classical</NativeSelectOption>
                  </NativeSelect>
                </div>

                <div className="space-y-2">
                  <Label>Format</Label>
                  <NativeSelect
                    value={formData.format}
                    onChange={(e) => setFormData((prev) => ({ ...prev, format: e.target.value }))}
                  >
                    <NativeSelectOption value="yaml">yaml</NativeSelectOption>
                    <NativeSelectOption value="text">text</NativeSelectOption>
                    {formData.source_type === 'external' && (
                      <NativeSelectOption value="mrs">mrs</NativeSelectOption>
                    )}
                  </NativeSelect>
                </div>
              </div>

              {/* external 特有字段 */}
              {formData.source_type === 'external' && (
                <>
                  <div className="space-y-2">
                    <Label>{t('ruleSets.sourceUrl')}</Label>
                    <Input
                      value={formData.url}
                      onChange={(e) => setFormData((prev) => ({ ...prev, url: e.target.value }))}
                      placeholder="https://..."
                    />
                    {formErrors.url && <p className="text-sm text-destructive">{formErrors.url}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Interval (秒)</Label>
                    <Input
                      type="number"
                      value={formData.interval}
                      onChange={(e) => setFormData((prev) => ({ ...prev, interval: e.target.value }))}
                    />
                  </div>
                </>
              )}

              {/* hosted 特有字段 */}
              {formData.source_type === 'hosted' && (
                <div className={dialogFullscreen ? 'flex flex-col flex-1 space-y-2 min-h-0' : 'space-y-2'}>
                  <div className="flex items-center justify-between">
                    <Label>{t('ruleSets.ruleContent')}</Label>
                    <a
                      href="https://wiki.metacubex.one/config/rule-providers/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:text-primary underline underline-offset-2"
                    >
                      格式文档 ↗
                    </a>
                  </div>
                  <YamlEditor
                    value={formData.content}
                    onChange={(v) => setFormData((prev) => ({ ...prev, content: v }))}
                    language={formData.format === 'yaml' ? 'yaml' : 'text'}
                    minHeight={dialogFullscreen ? 'calc(100vh - 350px)' : '200px'}
                    maxHeight={dialogFullscreen ? 'calc(100vh - 350px)' : '45vh'}
                    placeholder={formData.format === 'yaml'
                      ? 'payload:\n  - DOMAIN-SUFFIX,example.com\n  - DOMAIN-SUFFIX,google.com'
                      : 'DOMAIN-SUFFIX,example.com\nDOMAIN-SUFFIX,google.com'}
                  />
                  {formErrors.content && <p className="text-sm text-destructive">{formErrors.content}</p>}
                </div>
              )}
            </div>

            <DialogFooter className="flex-none">
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

      {/* 删除确认 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('ruleSets.deleteRuleSet')}</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            {t('ruleSets.deleteConfirm')}
            {deletingRuleSet && (
              <span className="font-medium text-foreground"> "{deletingRuleSet.name}"</span>
            )}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deletingRuleSet && deleteMutation.mutate({ id: deletingRuleSet.id, sourceType: deletingRuleSet.source_type })}
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
