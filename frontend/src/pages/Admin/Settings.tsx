import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { adminApi, type SystemSettings } from '@/api/admin'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function AdminSettings() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: adminApi.getSettings,
  })

  const [form, setForm] = useState<SystemSettings>({
    allow_registration: true,
    base_url: '',
    default_token_expiry_days: 0,
  })

  useEffect(() => {
    if (settings) setForm(settings)
  }, [settings])

  const updateMutation = useMutation({
    mutationFn: adminApi.updateSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(['admin-settings'], data)
      toast.success(t('common.success'))
    },
    onError: () => {
      toast.error(t('common.error'))
    },
  })

  const handleSave = () => {
    updateMutation.mutate(form)
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
  }

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="text-xl font-bold">{t('admin.systemSettings')}</h1>

      {/* 注册控制 */}
      <Card>
        <CardHeader className="py-4 px-4 pb-3">
          <CardTitle className="text-base">{t('admin.registrationControl')}</CardTitle>
          <CardDescription className="text-xs">
            {t('admin.registrationControlDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex items-center gap-3">
            <Switch
              id="allow-registration"
              checked={form.allow_registration}
              onCheckedChange={(checked) => setForm((f) => ({ ...f, allow_registration: checked }))}
            />
            <Label htmlFor="allow-registration" className="text-sm cursor-pointer">
              {form.allow_registration ? t('admin.registrationOpen') : t('admin.registrationClosed')}
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* 全局 Base URL */}
      <Card>
        <CardHeader className="py-4 px-4 pb-3">
          <CardTitle className="text-base">{t('admin.baseUrl')}</CardTitle>
          <CardDescription className="text-xs">
            {t('admin.baseUrlDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="space-y-1">
            <Input
              value={form.base_url}
              onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))}
              placeholder={t('admin.baseUrlPlaceholder')}
              className="h-8 text-sm font-mono"
            />
            <p className="text-xs text-muted-foreground">{t('admin.baseUrlHint')}</p>
          </div>
        </CardContent>
      </Card>

      {/* 默认订阅 Token 有效期 */}
      <Card>
        <CardHeader className="py-4 px-4 pb-3">
          <CardTitle className="text-base">{t('admin.defaultTokenExpiry')}</CardTitle>
          <CardDescription className="text-xs">
            {t('admin.defaultTokenExpiryDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              value={form.default_token_expiry_days}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  default_token_expiry_days: Math.max(0, parseInt(e.target.value) || 0),
                }))
              }
              className="h-8 text-sm w-28"
            />
            <span className="text-sm text-muted-foreground">{t('admin.days')}</span>
            {form.default_token_expiry_days === 0 && (
              <span className="text-xs text-muted-foreground">（{t('admin.neverExpires')}）</span>
            )}
          </div>
        </CardContent>
      </Card>

      <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
        {updateMutation.isPending ? t('common.saving') : t('common.save')}
      </Button>
    </div>
  )
}
