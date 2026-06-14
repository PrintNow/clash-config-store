import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useBreadcrumb } from '@/store/breadcrumb'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Copy,
  RefreshCw,
  Trash2,
  Plus,
  Save,
  Pencil,
  Check,
  X,
  ExternalLink,
  FileText,
  Info,
} from 'lucide-react'
import { subscriptionsApi } from '@/api/subscriptions'
import { customConfigsApi } from '@/api/custom-configs'
import { configTemplatesApi } from '@/api/config-templates'
import type { CustomConfig, ConfigTemplate, AccessRestriction } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select'
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
import { subscriptionPublicUrl } from '@/lib/subscription-url'

interface RestrictionForm {
  type: 'ip' | 'cidr' | 'country'
  value: string
  mode: 'allow' | 'deny'
}

export function SubscriptionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const subId = Number(id)

  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState('')

  useBreadcrumb([
    { label: t('nav.subscriptions'), href: '/subscriptions' },
    { label: name || '...' },
  ])

  const [customConfigId, setCustomConfigId] = useState<string>('')
  const [configTemplateId, setConfigTemplateId] = useState<string>('')
  const [ruleInsertMode, setRuleInsertMode] = useState<'prepend' | 'append' | 'replace'>('append')
  const [proxyPrefixEnabled, setProxyPrefixEnabled] = useState(false)
  const [tokenExpiredAt, setTokenExpiredAt] = useState('')

  const [restrictionDialogOpen, setRestrictionDialogOpen] = useState(false)
  const [restrictionForm, setRestrictionForm] = useState<RestrictionForm>({
    type: 'ip',
    value: '',
    mode: 'deny',
  })

  const { data: detailData, isLoading } = useQuery({
    queryKey: ['subscriptions', subId, 'detail'],
    queryFn: () => subscriptionsApi.getWithRestrictions(subId),
    enabled: !!subId,
  })

  const subscription = detailData?.subscription
  const restrictions: AccessRestriction[] = detailData?.access_restrictions ?? []

  const { data: customConfigs = [] } = useQuery<CustomConfig[]>({
    queryKey: ['custom-configs'],
    queryFn: customConfigsApi.list,
  })

  const { data: configTemplates = [] } = useQuery<ConfigTemplate[]>({
    queryKey: ['config-templates'],
    queryFn: configTemplatesApi.list,
  })

  useEffect(() => {
    if (subscription) {
      setName(subscription.name)
      setCustomConfigId(subscription.custom_config_id ? String(subscription.custom_config_id) : '')
      setConfigTemplateId(
        subscription.config_template_id ? String(subscription.config_template_id) : ''
      )
      setRuleInsertMode(subscription.rule_insert_mode ?? 'append')
      setProxyPrefixEnabled(subscription.proxy_prefix_enabled ?? false)
      setTokenExpiredAt(
        subscription.token_expired_at
          ? new Date(subscription.token_expired_at).toISOString().slice(0, 16)
          : ''
      )
    }
  }, [subscription])

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof subscriptionsApi.update>[1]) =>
      subscriptionsApi.update(subId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions', subId, 'detail'] })
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      toast.success(t('subscriptions.saveSuccess'))
      setEditingName(false)
    },
  })

  const regenerateTokenMutation = useMutation({
    mutationFn: () => subscriptionsApi.regenerateToken(subId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions', subId, 'detail'] })
      toast.success(t('subscriptions.regenerateSuccess'))
    },
  })

  const addRestrictionMutation = useMutation({
    mutationFn: (data: RestrictionForm) => subscriptionsApi.addRestriction(subId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions', subId, 'detail'] })
      toast.success(t('common.success'))
      setRestrictionDialogOpen(false)
      setRestrictionForm({ type: 'ip', value: '', mode: 'deny' })
    },
  })

  const deleteRestrictionMutation = useMutation({
    mutationFn: (restrictionId: number) =>
      subscriptionsApi.deleteRestriction(subId, restrictionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions', subId, 'detail'] })
      toast.success(t('common.success'))
    },
  })

  const handleSave = () => {
    updateMutation.mutate({
      name,
      custom_config_id: customConfigId ? Number(customConfigId) : null,
      config_template_id: configTemplateId ? Number(configTemplateId) : null,
      rule_insert_mode: ruleInsertMode,
      proxy_prefix_enabled: proxyPrefixEnabled,
      token_expired_at: tokenExpiredAt ? new Date(tokenExpiredAt).toISOString() : null,
    })
  }

  const handleNameSave = () => {
    if (name.trim()) {
      updateMutation.mutate({ name: name.trim() })
    }
  }

  const handleCopyUrl = () => {
    if (subscription) {
      navigator.clipboard.writeText(subscriptionPublicUrl(subscription))
      toast.success(t('subscriptions.copySuccess'))
    }
  }

  const getTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      ip: t('subscriptions.typeIP'),
      cidr: t('subscriptions.typeCIDR'),
      country: t('subscriptions.typeCountry'),
    }
    return map[type] ?? type
  }

  const selectedCustomConfig = customConfigs.find((c) => String(c.id) === customConfigId)
  const selectedTemplate = configTemplates.find((t) => String(t.id) === configTemplateId)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!subscription) {
    return <div className="text-center py-16 text-muted-foreground">{t('subscriptions.detail')}</div>
  }

  const subscriptionUrl = subscriptionPublicUrl(subscription)

  return (
    <div className="space-y-4">
      {/* ───── 顶部操作栏 ───── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate('/subscriptions')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>

          {editingName ? (
            <div className="flex items-center gap-1.5">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-8 text-base font-semibold w-48 sm:w-64"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNameSave()
                  if (e.key === 'Escape') {
                    setName(subscription.name)
                    setEditingName(false)
                  }
                }}
                autoFocus
              />
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleNameSave}>
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => {
                  setName(subscription.name)
                  setEditingName(false)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 min-w-0">
              <h1 className="text-xl font-semibold truncate">{subscription.name}</h1>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 shrink-0"
                onClick={() => setEditingName(true)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => navigate(`/subscriptions/${subId}/logs`)}>
            <ExternalLink className="mr-1.5 h-4 w-4" />
            {t('subscriptions.viewLogs')}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
            <Save className="mr-1.5 h-4 w-4" />
            {updateMutation.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </div>

      {/* ───── 订阅链接展示区 ───── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t('subscriptions.subscriptionUrl')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4">
          <div
            className="flex items-center gap-2 cursor-pointer group"
            onClick={handleCopyUrl}
            title={t('subscriptions.copySuccess')}
          >
            <code className="flex-1 text-xs sm:text-sm bg-muted px-3 py-2 rounded-md break-all font-mono group-hover:bg-muted/80 transition-colors">
              {subscriptionUrl}
            </code>
            <Button variant="outline" size="icon" className="shrink-0" onClick={(e) => { e.stopPropagation(); handleCopyUrl() }}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          <Separator />

          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="space-y-1.5 flex-1">
              <Label className="text-xs">{t('subscriptions.tokenExpiredAt')}</Label>
              <Input
                type="datetime-local"
                value={tokenExpiredAt}
                onChange={(e) => setTokenExpiredAt(e.target.value)}
                className="w-full sm:w-60 h-8 text-sm"
              />
              <p className="text-xs text-muted-foreground">{t('subscriptions.noExpiry')}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm(t('subscriptions.regenerateConfirm'))) {
                  regenerateTokenMutation.mutate()
                }
              }}
              disabled={regenerateTokenMutation.isPending}
            >
              <RefreshCw
                className={`mr-1.5 h-4 w-4 ${regenerateTokenMutation.isPending ? 'animate-spin' : ''}`}
              />
              {t('subscriptions.regenerateToken')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ───── 主配置 Tabs ───── */}
      <Card>
        <CardContent className="pt-4 px-4 pb-4">
          <Tabs defaultValue="config">
            <TabsList className="mb-4 w-full sm:w-auto">
              <TabsTrigger value="config" className="text-xs sm:text-sm">{t('subscriptions.tabConfig')}</TabsTrigger>
              <TabsTrigger value="template" className="text-xs sm:text-sm">{t('subscriptions.tabTemplate')}</TabsTrigger>
              <TabsTrigger value="restrictions" className="text-xs sm:text-sm">{t('subscriptions.tabRestrictions')}</TabsTrigger>
            </TabsList>

            {/* Tab 1：自定义配置 */}
            <TabsContent value="config" className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t('subscriptions.customConfig')}</Label>
                <NativeSelect
                  value={customConfigId || '__none__'}
                  onChange={(e) => setCustomConfigId(e.target.value === '__none__' ? '' : e.target.value)}
                >
                  <NativeSelectOption value="__none__">{t('subscriptions.noCustomConfig')}</NativeSelectOption>
                  {customConfigs.map((c) => (
                    <NativeSelectOption key={c.id} value={String(c.id)}>
                      {c.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>

              {customConfigs.length === 0 && (
                <div className="rounded-lg border border-dashed px-4 py-6 text-center">
                  <p className="text-sm font-medium">{t('subscriptions.noCustomConfigsTitle')}</p>
                  <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
                    {t('subscriptions.noCustomConfigsDescription')}
                  </p>
                  <Button
                    className="mt-4"
                    size="sm"
                    variant="outline"
                    onClick={() => navigate('/custom-configs')}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {t('customConfigs.addConfig')}
                  </Button>
                </div>
              )}

              {selectedCustomConfig && (
                <div className="rounded-md border bg-muted/40 p-3 space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    {selectedCustomConfig.name}
                  </p>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>
                      {t('customConfigs.tabProxies')}：{(selectedCustomConfig as unknown as { proxies?: unknown[] }).proxies?.length ?? 0}
                    </span>
                    <span>
                      {t('customConfigs.tabProxyGroups')}：{selectedCustomConfig.proxy_groups?.length ?? 0}
                    </span>
                    <span>
                      {t('customConfigs.tabRules')}：{selectedCustomConfig.rules?.length ?? 0}
                    </span>
                  </div>
                </div>
              )}

              <Separator />

              <div className="space-y-1.5">
                <Label>{t('subscriptions.ruleInsertMode')}</Label>
                <NativeSelect
                  value={ruleInsertMode}
                  onChange={(e) => setRuleInsertMode(e.target.value as typeof ruleInsertMode)}
                >
                  <NativeSelectOption value="prepend">{t('subscriptions.prepend')}</NativeSelectOption>
                  <NativeSelectOption value="append">{t('subscriptions.append')}</NativeSelectOption>
                  <NativeSelectOption value="replace">{t('subscriptions.replace')}</NativeSelectOption>
                </NativeSelect>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{t('subscriptions.proxyPrefixEnabled')}</p>
                  <p className="text-xs text-muted-foreground">{t('subscriptions.proxyPrefixDesc')}</p>
                </div>
                <Switch
                  checked={proxyPrefixEnabled}
                  onCheckedChange={setProxyPrefixEnabled}
                />
              </div>
            </TabsContent>

            {/* Tab 3：配置模板 */}
            <TabsContent value="template" className="space-y-4">
              <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <p>{t('configTemplates.contentHint')}</p>
              </div>

              <div className="space-y-1.5">
                <Label>{t('subscriptions.configTemplate')}</Label>
                <NativeSelect
                  value={configTemplateId || '__none__'}
                  onChange={(e) => setConfigTemplateId(e.target.value === '__none__' ? '' : e.target.value)}
                >
                  <NativeSelectOption value="__none__">{t('subscriptions.noConfigTemplate')}</NativeSelectOption>
                  {configTemplates.map((tmpl) => (
                    <NativeSelectOption key={tmpl.id} value={String(tmpl.id)}>
                      {tmpl.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>

              {selectedTemplate && (
                <div className="rounded-md border bg-muted/40 p-3 space-y-1">
                  <p className="text-sm font-medium">{selectedTemplate.name}</p>
                  {selectedTemplate.description && (
                    <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Tab 4：访问限制 */}
            <TabsContent value="restrictions" className="space-y-3">
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => {
                    setRestrictionForm({ type: 'ip', value: '', mode: 'deny' })
                    setRestrictionDialogOpen(true)
                  }}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  {t('subscriptions.addRestriction')}
                </Button>
              </div>

              {restrictions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {t('common.noData')}
                </div>
              ) : (
                <>
                  {/* 桌面端表格 */}
                  <div className="hidden sm:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('subscriptions.restrictionType')}</TableHead>
                          <TableHead>{t('subscriptions.restrictionValue')}</TableHead>
                          <TableHead>{t('subscriptions.restrictionMode')}</TableHead>
                          <TableHead className="w-[60px]">{t('common.actions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {restrictions.map((r) => (
                          <TableRow key={r.id}>
                            <TableCell>
                              <Badge variant="secondary">{getTypeLabel(r.type)}</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{r.value}</TableCell>
                            <TableCell>
                              <Badge variant={r.mode === 'allow' ? 'success' : 'destructive'}>
                                {r.mode === 'allow' ? t('subscriptions.allow') : t('subscriptions.deny')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => deleteRestrictionMutation.mutate(r.id)}
                                disabled={deleteRestrictionMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* 移动端卡片 */}
                  <div className="block sm:hidden space-y-2">
                    {restrictions.map((r) => (
                      <div key={r.id} className="flex items-center justify-between rounded-lg border p-3 gap-2">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="secondary" className="text-xs">{getTypeLabel(r.type)}</Badge>
                            <Badge variant={r.mode === 'allow' ? 'success' : 'destructive'} className="text-xs">
                              {r.mode === 'allow' ? t('subscriptions.allow') : t('subscriptions.deny')}
                            </Badge>
                          </div>
                          <p className="font-mono text-sm truncate">{r.value}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-destructive hover:text-destructive"
                          onClick={() => deleteRestrictionMutation.mutate(r.id)}
                          disabled={deleteRestrictionMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ───── 添加访问限制 Dialog ───── */}
      <Dialog open={restrictionDialogOpen} onOpenChange={setRestrictionDialogOpen}>
        <DialogContent>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault()
              if (!addRestrictionMutation.isPending && restrictionForm.value.trim()) {
                addRestrictionMutation.mutate(restrictionForm)
              }
            }}
          >
            <DialogHeader>
              <DialogTitle>{t('subscriptions.addRestriction')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>{t('subscriptions.restrictionType')}</Label>
                <NativeSelect
                  value={restrictionForm.type}
                  onChange={(e) =>
                    setRestrictionForm((prev) => ({
                      ...prev,
                      type: e.target.value as RestrictionForm['type'],
                    }))
                  }
                >
                  <NativeSelectOption value="ip">{t('subscriptions.typeIP')}</NativeSelectOption>
                  <NativeSelectOption value="cidr">{t('subscriptions.typeCIDR')}</NativeSelectOption>
                  <NativeSelectOption value="country">{t('subscriptions.typeCountry')}</NativeSelectOption>
                </NativeSelect>
              </div>

              <div className="space-y-2">
                <Label>{t('subscriptions.restrictionValue')}</Label>
                <Input
                  placeholder={
                    restrictionForm.type === 'ip'
                      ? '192.168.1.1'
                      : restrictionForm.type === 'cidr'
                        ? '192.168.1.0/24'
                        : 'CN'
                  }
                  value={restrictionForm.value}
                  onChange={(e) =>
                    setRestrictionForm((prev) => ({ ...prev, value: e.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>{t('subscriptions.restrictionMode')}</Label>
                <NativeSelect
                  value={restrictionForm.mode}
                  onChange={(e) =>
                    setRestrictionForm((prev) => ({
                      ...prev,
                      mode: e.target.value as RestrictionForm['mode'],
                    }))
                  }
                >
                  <NativeSelectOption value="allow">{t('subscriptions.allow')}</NativeSelectOption>
                  <NativeSelectOption value="deny">{t('subscriptions.deny')}</NativeSelectOption>
                </NativeSelect>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRestrictionDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={addRestrictionMutation.isPending || !restrictionForm.value.trim()}
              >
                {addRestrictionMutation.isPending ? t('common.submitting') : t('common.add')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
