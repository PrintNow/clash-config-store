import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { adminApi } from '@/api/admin'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

export function AdminSettings() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [allow, setAllow] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: adminApi.getSettings,
  })

  useEffect(() => {
    if (!data) return
    const raw = data.allow_registration
    setAllow(raw === 'true' || raw === '1')
  }, [data])

  const mutation = useMutation({
    mutationFn: (next: boolean) => adminApi.updateSettings(next),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] })
      toast.success(t('common.success'))
    },
  })

  const onToggle = (checked: boolean) => {
    setAllow(checked)
    mutation.mutate(checked)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('admin.settingsTitle')}</h1>
        <p className="text-muted-foreground text-sm">{t('admin.settingsSubtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.allowRegistration')}</CardTitle>
          <CardDescription>{t('admin.allowRegistrationHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-10 w-full max-w-sm" />
          ) : (
            <div className="flex items-center gap-3">
              <Switch
                id="allow-registration"
                checked={allow}
                disabled={mutation.isPending}
                onCheckedChange={onToggle}
              />
              <Label htmlFor="allow-registration" className="cursor-pointer">
                {allow ? t('common.enabled') : t('common.disabled')}
              </Label>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
