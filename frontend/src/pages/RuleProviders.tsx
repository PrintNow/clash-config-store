import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, Trash2, Edit, Shield, ExternalLink } from 'lucide-react'
import { ruleProvidersApi } from '@/api/rule-providers'
import { hostedRuleSetsApi } from '@/api/hosted-rule-sets'
import type { RuleProvider } from '@/types'
import type { HostedRuleSet } from '@/types'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// 表单初始值
const emptyForm = {
  name: '',
  type: 'http' as 'http' | 'file',
  source: 'external' as 'external' | 'hosted',
  url: '',
  hosted_rule_set_id: null as number | null,
  behavior: 'domain' as 'domain' | 'ipcidr' | 'classical',
  format: 'yaml' as 'yaml' | 'text' | 'mrs',
  interval: 86400,
}

// behavior 标签映射
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

// 格式标签映射
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
  const [editingProvider, setEditingProvider] = useState<RuleProvider | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RuleProvider | null>(null)
  const [form, setForm] = useState(emptyForm)

  // 加载规则集列表
  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['rule-providers'],
    queryFn: ruleProvidersApi.list,
  })

  const { data: hostedRuleSets = [] } = useQuery({
    queryKey: ['hosted-rule-sets'],
    queryFn: hostedRuleSetsApi.list,
  })

  // 区分内置预设和自定义
  const presetProviders = providers.filter((p) => p.is_preset)
  const customProviders = providers.filter((p) => !p.is_preset)

  // 创建 / 更新
  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        type: form.type,
        url: form.type === 'http' && form.source === 'external' ? form.url : undefined,
        hosted_rule_set_id: form.type === 'http' && form.source === 'hosted' ? form.hosted_rule_set_id : null,
        behavior: form.behavior,
        format: form.format,
        interval: form.interval,
      }
      return editingProvider
        ? ruleProvidersApi.update(editingProvider.id, payload)
        : ruleProvidersApi.create(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-providers'] })
      toast.success(
        editingProvider ? t('ruleProviders.updateSuccess') : t('ruleProviders.addSuccess')
      )
      closeDialog()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // 删除
  const deleteMutation = useMutation({
    mutationFn: (id: number) => ruleProvidersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rule-providers'] })
      toast.success(t('ruleProviders.deleteSuccess'))
      setDeleteTarget(null)
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // 打开新建对话框
  const openCreate = () => {
    setEditingProvider(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  // 打开编辑对话框
  const openEdit = (provider: RuleProvider) => {
    if (provider.is_preset) {
      toast.error(t('ruleProviders.cannotEdit'))
      return
    }
    setEditingProvider(provider)
    setForm({
      name: provider.name,
      type: provider.type,
      source: provider.hosted_rule_set_id ? 'hosted' : 'external',
      url: provider.hosted_rule_set_id ? '' : (provider.url ?? ''),
      hosted_rule_set_id: provider.hosted_rule_set_id ?? null,
      behavior: provider.behavior,
      format: provider.format,
      interval: provider.interval,
    })
    setDialogOpen(true)
  }

  // 关闭对话框
  const closeDialog = () => {
    setDialogOpen(false)
    setEditingProvider(null)
    setForm(emptyForm)
  }

  // 表单合法性校验
  const isFormValid =
    form.name.trim() !== '' &&
    (form.type === 'file' ||
      (form.source === 'external' ? form.url.trim() !== '' : form.hosted_rule_set_id !== null))

  // 加载骨架屏
  const renderSkeleton = () => (
    <div className="space-y-3 p-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )

  return (
    <div className="space-y-8">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('ruleProviders.title')}</h1>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t('ruleProviders.addProvider')}
        </Button>
      </div>

      {/* 内置预设区域 */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">{t('ruleProviders.loyalsoldierSection')}</h2>
        </div>
        <Separator />

        {isLoading ? (
          renderSkeleton()
        ) : presetProviders.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">{t('common.noData')}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {presetProviders.map((provider) => (
              <Card key={provider.id} className="border-muted">
                <CardHeader className="pb-2 pt-4 px-4">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-semibold leading-tight break-all">
                      {provider.name}
                    </CardTitle>
                    <Badge variant="destructive" className="shrink-0 text-xs">
                      {t('ruleProviders.presetBadge')}
                    </Badge>
                  </div>
                  {provider.preset_tag && (
                    <p className="text-xs text-muted-foreground mt-1">{provider.preset_tag}</p>
                  )}
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <BehaviorBadge behavior={provider.behavior} t={t} />
                    <FormatBadge format={provider.format} t={t} />
                    <Badge variant="outline" className="text-xs">
                      {provider.type === 'http'
                        ? t('ruleProviders.typeHttp')
                        : t('ruleProviders.typeFile')}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('ruleProviders.providerInterval')}：{provider.interval}s
                  </p>
                  {provider.url && (
                    <a
                      href={provider.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-500 hover:underline break-all"
                    >
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

      {/* 自定义规则集区域 */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">{t('ruleProviders.customSection')}</h2>
        <Separator />

        {isLoading ? (
          renderSkeleton()
        ) : customProviders.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">{t('common.noData')}</p>
        ) : (
          <div className="rounded-md border">
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
                    <TableCell>
                      {provider.type === 'http'
                        ? t('ruleProviders.typeHttp')
                        : t('ruleProviders.typeFile')}
                    </TableCell>
                    <TableCell>
                      <BehaviorBadge behavior={provider.behavior} t={t} />
                    </TableCell>
                    <TableCell>
                      <FormatBadge format={provider.format} t={t} />
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      {provider.url ? (
                        <a
                          href={provider.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-500 hover:underline text-sm"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span className="truncate">{provider.url}</span>
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>{provider.interval}s</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(provider)}
                        title={t('common.edit')}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTarget(provider)}
                        title={t('common.delete')}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      {/* 创建/编辑 Dialog */}
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
              <DialogTitle>
                {editingProvider ? t('ruleProviders.editProvider') : t('ruleProviders.addProvider')}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
            {/* 名称 */}
            <div className="space-y-1.5">
              <Label htmlFor="rp-name">{t('ruleProviders.providerName')}</Label>
              <Input
                id="rp-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t('ruleProviders.namePlaceholder')}
              />
            </div>

            {/* 类型 */}
            <div className="space-y-1.5">
              <Label>{t('ruleProviders.providerType')}</Label>
              <Select
                value={form.type}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    type: v as 'http' | 'file',
                    source: 'external',
                    url: '',
                    hosted_rule_set_id: null,
                  }))
                }
              >
                <SelectTrigger type="button">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="http">{t('ruleProviders.typeHttp')}</SelectItem>
                  <SelectItem value="file">{t('ruleProviders.typeFile')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.type === 'http' && (
              <div className="space-y-1.5">
                <Label>{t('ruleProviders.providerSource')}</Label>
                <Select
                  value={form.source}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      source: v as 'external' | 'hosted',
                      url: '',
                      hosted_rule_set_id: null,
                    }))
                  }
                >
                  <SelectTrigger type="button">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="external">{t('ruleProviders.sourceExternal')}</SelectItem>
                    <SelectItem value="hosted">{t('ruleProviders.sourceHosted')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* URL（仅 http + 外部 URL） */}
            {form.type === 'http' && form.source === 'external' && (
              <div className="space-y-1.5">
                <Label htmlFor="rp-url">
                  {t('ruleProviders.providerUrl')}
                  <span className="ml-1 text-destructive">*</span>
                </Label>
                <Input
                  id="rp-url"
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  placeholder={t('ruleProviders.urlPlaceholder')}
                />
              </div>
            )}

            {/* 托管规则集（仅 http + 托管） */}
            {form.type === 'http' && form.source === 'hosted' && (
              <div className="space-y-1.5">
                <Label>{t('ruleProviders.hostedRuleSet')}</Label>
                <Select
                  value={form.hosted_rule_set_id ? String(form.hosted_rule_set_id) : ''}
                  onValueChange={(v) => {
                    const id = Number(v)
                    const selected = hostedRuleSets.find((x: HostedRuleSet) => x.id === id)
                    setForm((f) => ({
                      ...f,
                      hosted_rule_set_id: id,
                      behavior: selected?.behavior ?? f.behavior,
                      format: selected?.format ?? f.format,
                    }))
                  }}
                >
                  <SelectTrigger type="button">
                    <SelectValue placeholder={t('ruleProviders.selectHostedRuleSet')} />
                  </SelectTrigger>
                  <SelectContent>
                    {hostedRuleSets.length === 0 ? (
                      <SelectItem value="0" disabled>
                        {t('common.noData')}
                      </SelectItem>
                    ) : (
                      hostedRuleSets.map((x: HostedRuleSet) => (
                        <SelectItem key={x.id} value={String(x.id)}>
                          {x.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Behavior */}
            <div className="space-y-1.5">
              <Label>{t('ruleProviders.providerBehavior')}</Label>
              <Select
                value={form.behavior}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, behavior: v as 'domain' | 'ipcidr' | 'classical' }))
                }
              >
                <SelectTrigger type="button">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="domain">{t('ruleProviders.behaviorDomain')}</SelectItem>
                  <SelectItem value="ipcidr">{t('ruleProviders.behaviorIpcidr')}</SelectItem>
                  <SelectItem value="classical">{t('ruleProviders.behaviorClassical')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 格式 */}
            <div className="space-y-1.5">
              <Label>{t('ruleProviders.providerFormat')}</Label>
              <Select
                value={form.format}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, format: v as 'yaml' | 'text' | 'mrs' }))
                }
              >
                <SelectTrigger type="button">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yaml">{t('ruleProviders.formatYaml')}</SelectItem>
                  <SelectItem value="text">{t('ruleProviders.formatText')}</SelectItem>
                  <SelectItem value="mrs">{t('ruleProviders.formatMrs')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 刷新间隔 */}
            <div className="space-y-1.5">
              <Label htmlFor="rp-interval">{t('ruleProviders.providerInterval')}</Label>
              <Input
                id="rp-interval"
                type="number"
                min={0}
                value={form.interval}
                onChange={(e) =>
                  setForm((f) => ({ ...f, interval: Number(e.target.value) }))
                }
              />
            </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={!isFormValid || saveMutation.isPending}>
                {saveMutation.isPending ? t('common.saving') : t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 删除确认 Dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{t('ruleProviders.deleteProvider')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            {deleteTarget?.is_preset
              ? t('ruleProviders.cannotDelete')
              : t('ruleProviders.deleteConfirm')}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t('common.cancel')}
            </Button>
            {!deleteTarget?.is_preset && (
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              >
                {t('common.delete')}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
