import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ArrowLeft, Save, Pencil, Check, X } from 'lucide-react'
import { customConfigsApi } from '@/api/custom-configs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function CustomConfigDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState('')
  const [proxies, setProxies] = useState('')
  const [proxyGroups, setProxyGroups] = useState('')
  const [rules, setRules] = useState('')

  const configId = Number(id)

  const { data: config, isLoading } = useQuery({
    queryKey: ['custom-configs', configId],
    queryFn: () => customConfigsApi.get(configId),
    enabled: !!configId,
  })

  // 初始化表单数据
  useEffect(() => {
    if (config) {
      setName(config.name)
      setProxies(config.proxies || '')
      setProxyGroups(config.proxy_groups || '')
      setRules(config.rules || '')
    }
  }, [config])

  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof customConfigsApi.update>[1]) =>
      customConfigsApi.update(configId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-configs', configId] })
      queryClient.invalidateQueries({ queryKey: ['custom-configs'] })
      toast.success(t('customConfigs.saveSuccess'))
      setEditingName(false)
    },
  })

  const handleSave = () => {
    updateMutation.mutate({ name, proxies, proxy_groups: proxyGroups, rules })
  }

  const handleNameSave = () => {
    if (name.trim()) {
      updateMutation.mutate({ name })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!config) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        规则集不存在
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/custom-configs')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>

          {/* 可内联编辑的名称 */}
          {editingName ? (
            <div className="flex items-center gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 text-lg font-bold"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleNameSave()
                  if (e.key === 'Escape') { setName(config.name); setEditingName(false) }
                }}
                autoFocus
              />
              <Button size="icon" variant="ghost" onClick={handleNameSave}>
                <Check className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => { setName(config.name); setEditingName(false) }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{config.name}</h1>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setEditingName(true)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          <Save className="mr-2 h-4 w-4" />
          {updateMutation.isPending ? t('common.saving') : t('common.save')}
        </Button>
      </div>

      {/* 编辑区域 */}
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('customConfigs.proxies')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              className="font-mono text-sm min-h-[200px] resize-y"
              placeholder={t('customConfigs.proxiesPlaceholder')}
              value={proxies}
              onChange={(e) => setProxies(e.target.value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('customConfigs.proxyGroups')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              className="font-mono text-sm min-h-[200px] resize-y"
              placeholder={t('customConfigs.proxyGroupsPlaceholder')}
              value={proxyGroups}
              onChange={(e) => setProxyGroups(e.target.value)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('customConfigs.rules')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              className="font-mono text-sm min-h-[300px] resize-y"
              placeholder={t('customConfigs.rulesPlaceholder')}
              value={rules}
              onChange={(e) => setRules(e.target.value)}
            />
          </CardContent>
        </Card>
      </div>

      {/* 底部保存按钮 */}
      <div className="flex justify-end pb-4">
        <Button onClick={handleSave} disabled={updateMutation.isPending} size="lg">
          <Save className="mr-2 h-4 w-4" />
          {updateMutation.isPending ? t('common.saving') : t('common.save')}
        </Button>
      </div>

    </div>
  )
}
