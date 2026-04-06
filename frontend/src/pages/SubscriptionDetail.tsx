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
} from 'lucide-react'
import { subscriptionsApi } from '@/api/subscriptions'
import { providersApi } from '@/api/providers'
import { customConfigsApi } from '@/api/custom-configs'
import type { AccessRestriction, Subscription } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  type: 'ip' | 'cidr' | 'country' | 'city'
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

  // 基础表单状态
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState('')
  const [enabledProviderIds, setEnabledProviderIds] = useState<number[]>([])
  const [customConfigId, setCustomConfigId] = useState<string>('')
  const [ruleInsertMode, setRuleInsertMode] = useState<'prepend' | 'append' | 'replace'>('append')
  const [proxyPrefixEnabled, setProxyPrefixEnabled] = useState(false)
  const [baseConfig, setBaseConfig] = useState('')
  const [tokenExpiredAt, setTokenExpiredAt] = useState('')

  // 访问限制 Dialog
  const [restrictionDialogOpen, setRestrictionDialogOpen] = useState(false)
  const [restrictionForm, setRestrictionForm] = useState<RestrictionForm>({
    type: 'ip',
    value: '',
    mode: 'deny',
  })

  const { data: subscription, isLoading } = useQuery({
    queryKey: ['subscriptions', subId],
    queryFn: () => subscriptionsApi.get(subId),
    enabled: !!subId,
  })

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: providersApi.list,
  })

  const { data: customConfigs = [] } = useQuery({
    queryKey: ['custom-configs'],
    queryFn: customConfigsApi.list,
  })

  const { data: restrictions = [], isLoading: restrictionsLoading } = useQuery({
    queryKey: ['subscriptions', subId, 'restrictions'],
    queryFn: () => subscriptionsApi.getRestrictions(subId),
    enabled: !!subId,
  })

  // 初始化表单数据
  useEffect(() => {
    if (subscription) {
      setName(subscription.name)
      setEnabledProviderIds(subscription.enabled_provider_ids || [])
      setCustomConfigId(subscription.custom_config_id ? String(subscription.custom_config_id) : '')
      setRuleInsertMode(subscription.rule_insert_mode || 'append')
      setProxyPrefixEnabled(subscription.proxy_prefix_enabled || false)
      setBaseConfig(subscription.base_config || '{}')
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
      queryClient.invalidateQueries({ queryKey: ['subscriptions', subId] })
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      toast.success(t('subscriptions.saveSuccess'))
      setEditingName(false)
    },
  })

  const regenerateTokenMutation = useMutation({
    mutationFn: () => subscriptionsApi.regenerateToken(subId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions', subId] })
      toast.success(t('subscriptions.regenerateSuccess'))
    },
  })

  const addRestrictionMutation = useMutation({
    mutationFn: (data: RestrictionForm) => subscriptionsApi.addRestriction(subId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions', subId, 'restrictions'] })
      toast.success(t('common.success'))
      setRestrictionDialogOpen(false)
    },
  })

  const deleteRestrictionMutation = useMutation({
    mutationFn: (restrictionId: number) =>
      subscriptionsApi.deleteRestriction(subId, restrictionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions', subId, 'restrictions'] })
      toast.success(t('common.success'))
    },
  })

  const handleSave = () => {
    updateMutation.mutate({
      name,
      enabled_provider_ids: enabledProviderIds,
      custom_config_id: customConfigId ? Number(customConfigId) : null,
      rule_insert_mode: ruleInsertMode,
      proxy_prefix_enabled: proxyPrefixEnabled,
      base_config: baseConfig,
      token_expired_at: tokenExpiredAt ? new Date(tokenExpiredAt).toISOString() : null,
    })
  }

  const handleNameSave = () => {
    if (name.trim()) {
      updateMutation.mutate({ name })
    }
  }

  const toggleProvider = (providerId: number) => {
    setEnabledProviderIds((prev) =>
      prev.includes(providerId)
        ? prev.filter((id) => id !== providerId)
        : [...prev, providerId]
    )
  }

  const handleCopyUrl = () => {
    if (subscription) {
      navigator.clipboard.writeText(subscriptionPublicUrl(subscription))
      toast.success(t('subscriptions.copySuccess'))
    }
  }

  // 限制类型翻译
  const getTypeLabel = (type: AccessRestriction['type']) => {
    const map = {
      ip: t('subscriptions.typeIP'),
      cidr: t('subscriptions.typeCIDR'),
      country: t('subscriptions.typeCountry'),
      city: t('subscriptions.typeCity'),
    }
    return map[type]
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!subscription) {
    return <div className="text-center py-16 text-muted-foreground">订阅不存在</div>
  }

  const subscriptionUrl = subscriptionPublicUrl(subscription)

  return (
    <div className="space-y-6">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/subscriptions')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>

          {editingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 text-lg font-bold"
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
                onClick={() => { setName(subscription.name); setEditingName(false) }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{subscription.name}</h1>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingName(true)}>
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/subscriptions/${subId}/logs`)}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            {t('subscriptions.viewLogs')}
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {updateMutation.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </div>

      {/* 订阅链接展示 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('subscriptions.subscriptionUrl')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-muted px-3 py-2 rounded-md break-all font-mono">
              {subscriptionUrl}
            </code>
            <Button variant="outline" size="icon" onClick={handleCopyUrl}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 主要配置 Tabs */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="providers">
            <TabsList className="mb-4">
              <TabsTrigger value="providers">{t('subscriptions.tabProviders')}</TabsTrigger>
              <TabsTrigger value="rules">{t('subscriptions.tabRules')}</TabsTrigger>
              <TabsTrigger value="baseConfig">{t('subscriptions.tabBaseConfig')}</TabsTrigger>
              <TabsTrigger value="restrictions">{t('subscriptions.tabRestrictions')}</TabsTrigger>
            </TabsList>

            {/* 代理源 Tab */}
            <TabsContent value="providers" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{t('subscriptions.proxyPrefixEnabled')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('subscriptions.proxyPrefixDesc')}
                  </p>
                </div>
                <Switch
                  checked={proxyPrefixEnabled}
                  onCheckedChange={setProxyPrefixEnabled}
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>{t('subscriptions.enabledProviders')}</Label>
                {providers.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">
                    {t('subscriptions.noProviders')}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {providers.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted">
                        <Checkbox
                          id={`provider-${p.id}`}
                          checked={enabledProviderIds.includes(p.id)}
                          onCheckedChange={() => toggleProvider(p.id)}
                        />
                        <label
                          htmlFor={`provider-${p.id}`}
                          className="flex-1 text-sm cursor-pointer"
                        >
                          <span className="font-medium">{p.name}</span>
                          <span className="text-muted-foreground ml-2 text-xs truncate">
                            {p.url}
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* 规则集 Tab */}
            <TabsContent value="rules" className="space-y-4">
              <div className="space-y-2">
                <Label>{t('subscriptions.customConfig')}</Label>
                <Select
                  value={customConfigId || '__none__'}
                  onValueChange={(v) => setCustomConfigId(v === '__none__' ? '' : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('subscriptions.selectCustomConfig')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t('subscriptions.noCustomConfig')}</SelectItem>
                    {customConfigs.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('subscriptions.ruleInsertMode')}</Label>
                <Select
                  value={ruleInsertMode}
                  onValueChange={(v) => setRuleInsertMode(v as typeof ruleInsertMode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="prepend">{t('subscriptions.prepend')}</SelectItem>
                    <SelectItem value="append">{t('subscriptions.append')}</SelectItem>
                    <SelectItem value="replace">{t('subscriptions.replace')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            {/* 基础配置 Tab */}
            <TabsContent value="baseConfig" className="space-y-4">
              <div className="space-y-2">
                <Label>{t('subscriptions.baseConfig')}</Label>
                <p className="text-xs text-muted-foreground">{t('subscriptions.baseConfigDesc')}</p>
                <Textarea
                  className="font-mono text-sm min-h-[300px] resize-y"
                  value={baseConfig}
                  onChange={(e) => setBaseConfig(e.target.value)}
                  placeholder='{"mixed-port": 7890, "dns": {}, "tun": {}}'
                />
              </div>
            </TabsContent>

            {/* 访问限制 Tab */}
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

              {restrictionsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : restrictions.length === 0 ? (
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
                      <TableHead className="w-[80px]">{t('common.actions')}</TableHead>
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
                            onClick={() => deleteRestrictionMutation.mutate(r.id)}
                            className="text-destructive hover:text-destructive"
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

      {/* Token 管理区 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('subscriptions.token')} & {t('subscriptions.tokenExpiredAt')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <code className="flex-1 text-sm bg-muted px-3 py-2 rounded-md font-mono break-all">
              {subscription.token}
            </code>
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

          <div className="space-y-2">
            <Label>{t('subscriptions.tokenExpiredAt')}</Label>
            <Input
              type="datetime-local"
              value={tokenExpiredAt}
              onChange={(e) => setTokenExpiredAt(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('subscriptions.noExpiry')}</p>
          </div>
        </CardContent>
      </Card>

      {/* 添加访问限制 Dialog */}
      <Dialog open={restrictionDialogOpen} onOpenChange={setRestrictionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('subscriptions.addRestriction')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t('subscriptions.restrictionType')}</Label>
              <Select
                value={restrictionForm.type}
                onValueChange={(v) =>
                  setRestrictionForm((p) => ({ ...p, type: v as RestrictionForm['type'] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ip">{t('subscriptions.typeIP')}</SelectItem>
                  <SelectItem value="cidr">{t('subscriptions.typeCIDR')}</SelectItem>
                  <SelectItem value="country">{t('subscriptions.typeCountry')}</SelectItem>
                  <SelectItem value="city">{t('subscriptions.typeCity')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('subscriptions.restrictionValue')}</Label>
              <Input
                placeholder={
                  restrictionForm.type === 'ip'
                    ? '192.168.1.1'
                    : restrictionForm.type === 'cidr'
                    ? '192.168.1.0/24'
                    : restrictionForm.type === 'country'
                    ? 'CN'
                    : '北京'
                }
                value={restrictionForm.value}
                onChange={(e) =>
                  setRestrictionForm((p) => ({ ...p, value: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>{t('subscriptions.restrictionMode')}</Label>
              <Select
                value={restrictionForm.mode}
                onValueChange={(v) =>
                  setRestrictionForm((p) => ({ ...p, mode: v as RestrictionForm['mode'] }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="allow">{t('subscriptions.allow')}</SelectItem>
                  <SelectItem value="deny">{t('subscriptions.deny')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestrictionDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => addRestrictionMutation.mutate(restrictionForm)}
              disabled={addRestrictionMutation.isPending || !restrictionForm.value.trim()}
            >
              {addRestrictionMutation.isPending ? t('common.submitting') : t('common.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
