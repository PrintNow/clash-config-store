import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
import { providersApi } from '@/api/providers'
import { customConfigsApi } from '@/api/custom-configs'
import { configTemplatesApi } from '@/api/config-templates'
import type { Subscription, Provider, CustomConfig, ConfigTemplate, AccessRestriction } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
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

interface RestrictionForm {
  type: 'ip' | 'cidr' | 'country'
  value: string
  mode: 'allow' | 'deny'
}

/** 开发走 Vite proxy（同 origin）；生产优先用后端 BASE_URL 拼的 subscription_url */
function subscriptionPublicUrl(sub: Pick<Subscription, 'token' | 'subscription_url'>): string {
  if (import.meta.env.DEV) {
    return `${window.location.origin}/sub/${sub.token}`
  }
  return sub.subscription_url ?? `${window.location.origin}/sub/${sub.token}`
}

export function SubscriptionDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const subId = Number(id)

  // 内联名称编辑状态
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState('')

  // 表单字段状态
  const [enabledProviderIds, setEnabledProviderIds] = useState<number[]>([])
  const [customConfigId, setCustomConfigId] = useState<string>('')
  const [configTemplateId, setConfigTemplateId] = useState<string>('')
  const [ruleInsertMode, setRuleInsertMode] = useState<'prepend' | 'append' | 'replace'>('append')
  const [proxyPrefixEnabled, setProxyPrefixEnabled] = useState(false)
  const [tokenExpiredAt, setTokenExpiredAt] = useState('')

  // 访问限制 Dialog 状态
  const [restrictionDialogOpen, setRestrictionDialogOpen] = useState(false)
  const [restrictionForm, setRestrictionForm] = useState<RestrictionForm>({
    type: 'ip',
    value: '',
    mode: 'deny',
  })

  // 一次性拉取订阅 + 访问限制
  const { data: detailData, isLoading } = useQuery({
    queryKey: ['subscriptions', subId, 'detail'],
    queryFn: () => subscriptionsApi.getWithRestrictions(subId),
    enabled: !!subId,
  })

  const subscription = detailData?.subscription
  const restrictions: AccessRestriction[] = detailData?.access_restrictions ?? []

  const { data: providers = [] } = useQuery<Provider[]>({
    queryKey: ['providers'],
    queryFn: providersApi.list,
  })

  const { data: customConfigs = [] } = useQuery<CustomConfig[]>({
    queryKey: ['custom-configs'],
    queryFn: customConfigsApi.list,
  })

  const { data: configTemplates = [] } = useQuery<ConfigTemplate[]>({
    queryKey: ['config-templates'],
    queryFn: configTemplatesApi.list,
  })

  // 订阅数据加载后初始化表单
  useEffect(() => {
    if (subscription) {
      setName(subscription.name)
      setEnabledProviderIds(subscription.enabled_provider_ids ?? [])
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

  // 保存全部字段
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

  // 保存所有字段变更
  const handleSave = () => {
    updateMutation.mutate({
      name,
      enabled_provider_ids: enabledProviderIds,
      custom_config_id: customConfigId ? Number(customConfigId) : null,
      config_template_id: configTemplateId ? Number(configTemplateId) : null,
      rule_insert_mode: ruleInsertMode,
      proxy_prefix_enabled: proxyPrefixEnabled,
      token_expired_at: tokenExpiredAt ? new Date(tokenExpiredAt).toISOString() : null,
    })
  }

  // 仅保存名称（内联编辑）
  const handleNameSave = () => {
    if (name.trim()) {
      updateMutation.mutate({ name: name.trim() })
    }
  }

  const toggleProvider = (providerId: number) => {
    setEnabledProviderIds((prev) =>
      prev.includes(providerId) ? prev.filter((pid) => pid !== providerId) : [...prev, providerId]
    )
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

  // 当前选中的自定义配置对象（用于显示摘要）
  const selectedCustomConfig = customConfigs.find((c) => String(c.id) === customConfigId)
  // 当前选中的配置模板对象
  const selectedTemplate = configTemplates.find((t) => String(t.id) === configTemplateId)

  // 计算自定义配置里 proxy-groups use: 引用了哪些 Provider 名称
  const referencedProviderNames: string[] = (() => {
    if (!selectedCustomConfig?.proxy_groups) return []
    const names = new Set<string>()
    for (const g of selectedCustomConfig.proxy_groups) {
      const use = (g as Record<string, unknown>)['use']
      if (Array.isArray(use)) {
        use.forEach((n) => typeof n === 'string' && names.add(n))
      }
    }
    return [...names]
  })()

  // 找出"被引用但未在本订阅启用"的 Provider
  const unenabledReferencedProviders = referencedProviderNames.filter((name) => {
    const provider = providers.find((p) => p.name === name)
    return provider && !enabledProviderIds.includes(provider.id)
  })

  // 一键启用引用中未启用的 Provider
  const handleEnableReferenced = () => {
    const idsToAdd = referencedProviderNames
      .map((name) => providers.find((p) => p.name === name)?.id)
      .filter((id): id is number => id !== undefined && !enabledProviderIds.includes(id))
    setEnabledProviderIds((prev) => [...prev, ...idsToAdd])
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
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
    <div className="space-y-6">
      {/* ───── 顶部操作栏 ───── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          {/* 返回按钮 */}
          <Button variant="ghost" size="icon" onClick={() => navigate('/subscriptions')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>

          {/* 内联名称编辑 */}
          {editingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 text-lg font-bold w-64"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNameSave()
                  if (e.key === 'Escape') {
                    setName(subscription.name)
                    setEditingName(false)
                  }
                }}
                autoFocus
              />
              <Button size="icon" variant="ghost" onClick={handleNameSave}>
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setName(subscription.name)
                  setEditingName(false)
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-2xl font-bold truncate">{subscription.name}</h1>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                onClick={() => setEditingName(true)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* 查看访问日志 */}
          <Button variant="outline" onClick={() => navigate(`/subscriptions/${subId}/logs`)}>
            <ExternalLink className="mr-2 h-4 w-4" />
            {t('subscriptions.viewLogs')}
          </Button>
          {/* 保存所有配置 */}
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {updateMutation.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </div>

      {/* ───── 订阅链接展示区 ───── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('subscriptions.subscriptionUrl')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 订阅 URL 大框 */}
          <div
            className="flex items-center gap-2 cursor-pointer group"
            onClick={handleCopyUrl}
            title={t('subscriptions.copySuccess')}
          >
            <code className="flex-1 text-sm bg-muted px-3 py-3 rounded-md break-all font-mono group-hover:bg-muted/80 transition-colors">
              {subscriptionUrl}
            </code>
            <Button variant="outline" size="icon" onClick={(e) => { e.stopPropagation(); handleCopyUrl() }}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          <Separator />

          {/* Token 过期时间 + 重新生成 */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-4">
            <div className="space-y-2 flex-1">
              <Label>{t('subscriptions.tokenExpiredAt')}</Label>
              <Input
                type="datetime-local"
                value={tokenExpiredAt}
                onChange={(e) => setTokenExpiredAt(e.target.value)}
                className="w-full sm:w-64"
              />
              <p className="text-xs text-muted-foreground">{t('subscriptions.noExpiry')}</p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                if (confirm(t('subscriptions.regenerateConfirm'))) {
                  regenerateTokenMutation.mutate()
                }
              }}
              disabled={regenerateTokenMutation.isPending}
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${regenerateTokenMutation.isPending ? 'animate-spin' : ''}`}
              />
              {t('subscriptions.regenerateToken')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ───── 主配置 Tabs ───── */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="providers">
            <TabsList className="mb-6 w-full sm:w-auto">
              <TabsTrigger value="providers">{t('subscriptions.tabProviders')}</TabsTrigger>
              <TabsTrigger value="config">{t('subscriptions.tabConfig')}</TabsTrigger>
              <TabsTrigger value="template">{t('subscriptions.tabTemplate')}</TabsTrigger>
              <TabsTrigger value="restrictions">{t('subscriptions.tabRestrictions')}</TabsTrigger>
            </TabsList>

            {/* Tab 1：订阅源 */}
            <TabsContent value="providers" className="space-y-4">
              <div className="space-y-1">
                <Label>{t('subscriptions.enabledProviders')}</Label>
                <p className="text-xs text-muted-foreground">
                  勾选后点击右上角「保存」生效。代理组中通过「引用订阅源」使用的 Provider 必须在此启用。
                </p>
              </div>

              {/* 检测到引用未启用的快捷提示 */}
              {unenabledReferencedProviders.length > 0 && (
                <div className="flex items-center justify-between rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2">
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    ⚠️ 自定义配置引用了 <strong>{unenabledReferencedProviders.join(', ')}</strong>，但未启用
                  </p>
                  <Button size="sm" variant="ghost" className="h-6 text-xs text-amber-700 dark:text-amber-400 px-2" onClick={handleEnableReferenced}>
                    一键启用
                  </Button>
                </div>
              )}

              {providers.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">
                  {t('subscriptions.noProviders')}
                </div>
              ) : (
                <div className="space-y-1 max-h-80 overflow-y-auto rounded-md border p-2">
                  {providers.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-start gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                      onClick={() => toggleProvider(p.id)}
                    >
                      <Checkbox
                        id={`provider-${p.id}`}
                        checked={enabledProviderIds.includes(p.id)}
                        onCheckedChange={() => toggleProvider(p.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-none">{p.name}</p>
                        <p className="text-xs text-muted-foreground mt-1 truncate">{p.url}</p>
                        {p.last_fetched_at && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t('providers.lastFetched')}：
                            {new Date(p.last_fetched_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                      {enabledProviderIds.includes(p.id) && (
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          {t('common.enabled')}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                {t('subscriptions.enabledProviders')}：{enabledProviderIds.length} / {providers.length}
              </p>
            </TabsContent>

            {/* Tab 2：自定义配置 */}
            <TabsContent value="config" className="space-y-6">
              {/* 选择自定义配置 */}
              <div className="space-y-2">
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

              {/* 已选配置摘要信息 */}
              {selectedCustomConfig && (
                <div className="rounded-md border bg-muted/40 p-4 space-y-2">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    {selectedCustomConfig.name}
                  </p>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>
                      {t('customConfigs.tabProxies')}：{selectedCustomConfig.proxies?.length ?? 0}
                    </span>
                    <span>
                      {t('customConfigs.tabProxyGroups')}：{selectedCustomConfig.proxy_groups?.length ?? 0}
                    </span>
                    <span>
                      {t('customConfigs.tabRules')}：{selectedCustomConfig.rules?.length ?? 0}
                    </span>
                  </div>

                  {/* 引用了订阅源但未启用的警告 */}
                  {unenabledReferencedProviders.length > 0 && (
                    <div className="mt-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 space-y-2">
                      <p className="text-xs font-medium text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                        <span>⚠️</span>
                        以下订阅源被代理组引用，但尚未在「订阅源」Tab 中启用，生成的 YAML 将缺少这些节点：
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {unenabledReferencedProviders.map((name) => (
                          <Badge key={name} variant="outline" className="text-amber-700 dark:text-amber-400 border-amber-400">
                            {name}
                          </Badge>
                        ))}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-amber-400 text-amber-700 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-950"
                        onClick={handleEnableReferenced}
                      >
                        一键启用这些订阅源
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <Separator />

              {/* 规则插入模式 */}
              <div className="space-y-2">
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

              {/* 节点前缀 Switch */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-1">
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
            <TabsContent value="template" className="space-y-6">
              {/* 提示说明 */}
              <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                <Info className="h-4 w-4 mt-0.5 shrink-0" />
                <p>{t('configTemplates.contentHint')}</p>
              </div>

              {/* 选择配置模板 */}
              <div className="space-y-2">
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

              {/* 已选模板摘要 */}
              {selectedTemplate && (
                <div className="rounded-md border bg-muted/40 p-4 space-y-2">
                  <p className="text-sm font-medium">{selectedTemplate.name}</p>
                  {selectedTemplate.description && (
                    <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
                  )}
                </div>
              )}
            </TabsContent>

            {/* Tab 4：访问限制 */}
            <TabsContent value="restrictions" className="space-y-4">
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    setRestrictionForm({ type: 'ip', value: '', mode: 'deny' })
                    setRestrictionDialogOpen(true)
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t('subscriptions.addRestriction')}
                </Button>
              </div>

              {restrictions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {t('common.noData')}
                </div>
              ) : (
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
              {/* 限制类型 */}
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

            {/* 限制值 */}
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

            {/* 限制模式 */}
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
