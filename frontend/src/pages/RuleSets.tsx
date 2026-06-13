import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { ruleSetsApi } from '@/api/rule-sets'
import type { RuleSet } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'

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

  const [activeTab, setActiveTab] = useState<TabValue>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
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
    setDialogOpen(true)
  }

  const openEditDialog = (rs: RuleSet) => {
    setEditingRuleSet(rs)
    setFormData({
      source_type: rs.source_type,
      name: rs.name,
      behavior: rs.behavior,
      format: rs.format,
      url: rs.url ?? '',
      interval: String(rs.interval ?? 86400),
      content: rs.content ?? '',
    })
    setFormErrors({})
    setDialogOpen(true)
  }

  const validateForm = () => {
    const errors: Partial<Record<keyof RuleSetFormData, string>> = {}
    if (!formData.name.trim()) errors.name = t('common.required')
    if (formData.source_type === 'external' && !formData.url.trim()) errors.url = t('common.required')
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
      )
    }

    if (items.length === 0) {
      return (
        <EmptyState
          title={t('ruleSets.emptyTitle')}
          description={t('ruleSets.emptyDescription')}
          actions={
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="mr-2 h-4 w-4" />
              {t('ruleSets.addRuleSet')}
            </Button>
          }
        />
      )
    }

    return (
      <div className="rounded-lg border">
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
            {items.map((rs) => (
              <TableRow key={rs.id}>
                <TableCell className="font-medium">{rs.name}</TableCell>
                <TableCell>{renderSourceTypeBadge(rs)}</TableCell>
                <TableCell>
                  <Badge variant="outline">{rs.behavior}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{rs.format}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(rs)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setDeletingRuleSet(rs); setDeleteDialogOpen(true) }}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('ruleSets.title')}</h1>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
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

        <TabsContent value="all" className="mt-4">
          {renderTable(filteredRuleSets)}
        </TabsContent>
        <TabsContent value="external" className="mt-4">
          {renderTable(filteredRuleSets)}
        </TabsContent>
        <TabsContent value="hosted" className="mt-4">
          {renderTable(filteredRuleSets)}
        </TabsContent>
      </Tabs>

      {/* 添加/编辑弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => { e.preventDefault(); handleSubmit() }}
          >
            <DialogHeader>
              <DialogTitle>
                {editingRuleSet ? t('ruleSets.editRuleSet') : t('ruleSets.addRuleSet')}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
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

              {/* 名称 */}
              <div className="space-y-2">
                <Label>{t('common.name')}</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="my-rules"
                />
                {formErrors.name && <p className="text-sm text-destructive">{formErrors.name}</p>}
              </div>

              {/* Behavior */}
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

              {/* Format */}
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
                <div className="space-y-2">
                  <Label>{t('ruleSets.ruleContent')}</Label>
                  <Textarea
                    value={formData.content}
                    onChange={(e) => setFormData((prev) => ({ ...prev, content: e.target.value }))}
                    placeholder={'example.com\ngoogle.com'}
                    className="min-h-[160px] font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">每行一条规则</p>
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
