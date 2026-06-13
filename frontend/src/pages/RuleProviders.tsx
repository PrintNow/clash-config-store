import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, Trash2, Edit, Shield, ExternalLink } from 'lucide-react'
import { ruleSetsApi } from '@/api/rule-sets'
import type { RuleSet } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'

const emptyForm = {
  name: '',
  type: 'http' as 'http' | 'file',
  url: '',
  behavior: 'domain' as 'domain' | 'ipcidr' | 'classical',
  format: 'yaml' as 'yaml' | 'text' | 'mrs',
  interval: 86400,
}

function BehaviorBadge({ behavior, t }: { behavior: string; t: (k: string) => string }) {
  const map: Record<string, string> = {
    domain: t('ruleProviders.behaviorDomain'),
    ipcidr: t('ruleProviders.behaviorIpcidr'),
    classical: t('ruleProviders.behaviorClassical'),
  }
  const variantMap: Record<string, 'default' | 'secondary' | 'outline'> = {
    domain: 'default',
    ipcidr: 'secondary',
    classical: 'outline',
  }
  return <Badge variant={variantMap[behavior] ?? 'outline'}>{map[behavior] ?? behavior}</Badge>
}

function FormatBadge({ format, t }: { format: string; t: (k: string) => string }) {
  const map: Record<string, string> = {
    yaml: t('ruleProviders.formatYaml'),
    text: t('ruleProviders.formatText'),
    mrs: t('ruleProviders.formatMrs'),
  }
  return <Badge variant="outline">{map[format] ?? format}</Badge>
}

export function RuleProviders() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProvider, setEditingProvider] = useState<RuleSet | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RuleSet | null>(null)
  const [form, setForm] = useState(emptyForm)

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['rule-sets', 'external'],
    queryFn: () => ruleSetsApi.list('external'),
  })

  const presetProviders = providers.filter((p) => p.is_preset)
  const customProviders = providers.filter((p) => !p.is_preset)

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        type: form.type,
        url: form.type === 'http' ? form.url : undefined,
        behavior: form.behavior,
        format: form.format,
        interval: form.interval,
      }
      return editingProvider
        ? ruleSetsApi.update(editingProvider.id, { source_type: 'external', ...payload })
        : ruleSetsApi.create({ source_type: 'external', ...payload })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-sets', 'external'] })
      toast.success(editingProvider ? t('ruleProviders.updateSuccess') : t('ruleProviders.addSuccess'))
      closeDialog()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => ruleSetsApi.delete(id, 'external'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-sets', 'external'] })
      toast.success(t('ruleProviders.deleteSuccess'))
      setDeleteTarget(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const openCreate = () => {
    setEditingProvider(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (provider: RuleSet) => {
    if (provider.is_preset) {
      toast.error(t('ruleProviders.cannotEdit'))
      return
    }
    setEditingProvider(provider)
    setForm({
      name: provider.name,
      type: 'http',
      url: provider.url ?? '',
      behavior: provider.behavior,
      format: provider.format,
      interval: provider.interval ?? 86400,
    })
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingProvider(null)
    setForm(emptyForm)
  }

  const isFormValid = form.name.trim() !== '' && (form.type === 'file' || form.url.trim() !== '')

  const renderSkeleton = () => (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* 标题区 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('ruleProviders.title')}</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          {t('ruleProviders.addProvider')}
        </Button>
      </div>

      {/* 预设 Provider 区块 */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-base font-semibold">{t('ruleProviders.loyalsoldierSection')}</h2>
        </div>
        <Separator />

        {isLoading ? renderSkeleton() : presetProviders.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">{t('common.noData')}</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {presetProviders.map((provider) => (
              <Card key={provider.id} className="border-muted">
                <CardHeader className="px-3 pb-1.5 pt-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-semibold leading-tight break-all">{provider.name}</CardTitle>
                    <Badge variant="destructive" className="shrink-0 text-xs">{t('ruleProviders.presetBadge')}</Badge>
                  </div>
                  {provider.preset_tag && <p className="mt-1 text-xs text-muted-foreground">{provider.preset_tag}</p>}
                </CardHeader>
                <CardContent className="space-y-1.5 px-3 pb-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <BehaviorBadge behavior={provider.behavior} t={t} />
                    <FormatBadge format={provider.format} t={t} />
                    <Badge variant="outline" className="text-xs">
                      {t('ruleProviders.typeHttp')}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{t('ruleProviders.providerInterval')}：{provider.interval}s</p>
                  {provider.url && (
                    <a href={provider.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 break-all text-xs text-blue-500 hover:underline">
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="line-clamp-1">{provider.url}</span>
                    </a>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* 自定义 Provider 区块 */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold">{t('ruleProviders.customSection')}</h2>
        <Separator />

        {isLoading ? renderSkeleton() : customProviders.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">{t('common.noData')}</p>
        ) : (
          <>
            {/* 桌面端表格 */}
            <div className="hidden sm:block rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('ruleProviders.providerName')}</TableHead>
                    <TableHead>{t('ruleProviders.providerType')}</TableHead>
                    <TableHead>{t('ruleProviders.providerBehavior')}</TableHead>
                    <TableHead>{t('ruleProviders.providerFormat')}</TableHead>
                    <TableHead>{t('ruleProviders.providerUrl')}</TableHead>
                    <TableHead>{t('ruleProviders.providerInterval')}</TableHead>
                    <TableHead className="text-right">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customProviders.map((provider) => (
                    <TableRow key={provider.id}>
                      <TableCell className="font-medium">{provider.name}</TableCell>
                      <TableCell>{t('ruleProviders.typeHttp')}</TableCell>
                      <TableCell><BehaviorBadge behavior={provider.behavior} t={t} /></TableCell>
                      <TableCell><FormatBadge format={provider.format} t={t} /></TableCell>
                      <TableCell className="max-w-[200px]">
                        {provider.url ? (
                          <a href={provider.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-blue-500 hover:underline">
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            <span className="truncate">{provider.url}</span>
                          </a>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{provider.interval}s</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(provider)} title={t('common.edit')}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteTarget(provider)} title={t('common.delete')}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* 移动端卡片 */}
            <div className="block sm:hidden space-y-2">
              {customProviders.map((provider) => (
                <Card key={provider.id}>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{provider.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {t('ruleProviders.typeHttp')}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <BehaviorBadge behavior={provider.behavior} t={t} />
                          <FormatBadge format={provider.format} t={t} />
                          <span className="text-xs text-muted-foreground">{provider.interval}s</span>
                        </div>
                        {provider.url && (
                          <a href={provider.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-500 hover:underline truncate">
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            <span className="truncate">{provider.url}</span>
                          </a>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(provider)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteTarget(provider)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </section>

      {/* 创建/编辑弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="sm:max-w-[480px]">
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (isFormValid && !saveMutation.isPending) saveMutation.mutate()
            }}
          >
            <DialogHeader>
              <DialogTitle>{editingProvider ? t('ruleProviders.editProvider') : t('ruleProviders.addProvider')}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="rp-name">{t('ruleProviders.providerName')}</Label>
                <Input id="rp-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t('ruleProviders.namePlaceholder')} />
              </div>

              <div className="space-y-1.5">
                <Label>{t('ruleProviders.providerType')}</Label>
                <NativeSelect
                  value={form.type}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, type: e.target.value as 'http' | 'file', url: '' }))
                  }
                >
                  <NativeSelectOption value="http">{t('ruleProviders.typeHttp')}</NativeSelectOption>
                  <NativeSelectOption value="file">{t('ruleProviders.typeFile')}</NativeSelectOption>
                </NativeSelect>
              </div>

              {form.type === 'http' && (
                <div className="space-y-1.5">
                  <Label htmlFor="rp-url">
                    {t('ruleProviders.providerUrl')}
                    <span className="ml-1 text-destructive">*</span>
                  </Label>
                  <Input id="rp-url" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder={t('ruleProviders.urlPlaceholder')} />
                </div>
              )}

              <div className="space-y-1.5">
                <Label>{t('ruleProviders.providerBehavior')}</Label>
                <NativeSelect
                  value={form.behavior}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      behavior: e.target.value as 'domain' | 'ipcidr' | 'classical',
                    }))
                  }
                >
                  <NativeSelectOption value="domain">{t('ruleProviders.behaviorDomain')}</NativeSelectOption>
                  <NativeSelectOption value="ipcidr">{t('ruleProviders.behaviorIpcidr')}</NativeSelectOption>
                  <NativeSelectOption value="classical">{t('ruleProviders.behaviorClassical')}</NativeSelectOption>
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label>{t('ruleProviders.providerFormat')}</Label>
                <NativeSelect
                  value={form.format}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, format: e.target.value as 'yaml' | 'text' | 'mrs' }))
                  }
                >
                  <NativeSelectOption value="yaml">{t('ruleProviders.formatYaml')}</NativeSelectOption>
                  <NativeSelectOption value="text">{t('ruleProviders.formatText')}</NativeSelectOption>
                  <NativeSelectOption value="mrs">{t('ruleProviders.formatMrs')}</NativeSelectOption>
                </NativeSelect>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rp-interval">{t('ruleProviders.providerInterval')}</Label>
                <Input id="rp-interval" type="number" min={0} value={form.interval} onChange={(e) => setForm((f) => ({ ...f, interval: Number(e.target.value) }))} />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={!isFormValid || saveMutation.isPending}>
                {saveMutation.isPending ? t('common.saving') : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 删除确认弹窗 */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t('ruleProviders.deleteProvider')}</DialogTitle>
          </DialogHeader>
          <p className="py-2 text-sm text-muted-foreground">
            {deleteTarget?.is_preset ? t('ruleProviders.cannotDelete') : t('ruleProviders.deleteConfirm')}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>{t('common.cancel')}</Button>
            {!deleteTarget?.is_preset && (
              <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
                {t('common.delete')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
