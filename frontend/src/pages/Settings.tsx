import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { userApi } from '@/api/user'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export function Settings() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { setAuth, token } = useAuthStore()

  // 个人信息表单
  const [profileForm, setProfileForm] = useState({ name: '', email: '' })
  const [profileErrors, setProfileErrors] = useState<{ name?: string; email?: string }>({})

  // 密码表单
  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  })
  const [passwordErrors, setPasswordErrors] = useState<{
    old_password?: string
    new_password?: string
    confirm_password?: string
  }>({})

  const { data: profile } = useQuery({
    queryKey: ['user-profile'],
    queryFn: userApi.getProfile,
  })

  // 初始化表单
  useEffect(() => {
    if (profile) {
      setProfileForm({ name: profile.name, email: profile.email })
    }
  }, [profile])

  const updateProfileMutation = useMutation({
    mutationFn: userApi.updateProfile,
    onSuccess: (updatedUser) => {
      queryClient.invalidateQueries({ queryKey: ['user-profile'] })
      // 同步更新 auth store 中的用户信息
      if (token) {
        setAuth(token, updatedUser)
      }
      toast.success(t('settings.profileUpdated'))
      setProfileErrors({})
    },
  })

  const changePasswordMutation = useMutation({
    mutationFn: userApi.changePassword,
    onSuccess: () => {
      toast.success(t('settings.passwordChanged'))
      setPasswordForm({ old_password: '', new_password: '', confirm_password: '' })
      setPasswordErrors({})
    },
  })

  const validateProfile = () => {
    const errors: typeof profileErrors = {}
    if (!profileForm.name.trim()) errors.name = t('common.required')
    if (!profileForm.email.trim()) errors.email = t('common.required')
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileForm.email))
      errors.email = t('auth.emailInvalid')
    setProfileErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validatePassword = () => {
    const errors: typeof passwordErrors = {}
    if (!passwordForm.old_password) errors.old_password = t('settings.oldPasswordRequired')
    if (!passwordForm.new_password) errors.new_password = t('settings.newPasswordRequired')
    if (passwordForm.new_password !== passwordForm.confirm_password)
      errors.confirm_password = t('settings.passwordMismatch')
    setPasswordErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateProfile()) return
    updateProfileMutation.mutate(profileForm)
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validatePassword()) return
    changePasswordMutation.mutate({
      old_password: passwordForm.old_password,
      new_password: passwordForm.new_password,
    })
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">{t('settings.title')}</h1>

      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.basicInfo')}</CardTitle>
          <CardDescription>
            更新你的用户名和邮箱地址
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">{t('settings.username')}</Label>
              <Input
                id="username"
                value={profileForm.name}
                onChange={(e) =>
                  setProfileForm((p) => ({ ...p, name: e.target.value }))
                }
              />
              {profileErrors.name && (
                <p className="text-sm text-destructive">{profileErrors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('settings.email')}</Label>
              <Input
                id="email"
                type="email"
                value={profileForm.email}
                onChange={(e) =>
                  setProfileForm((p) => ({ ...p, email: e.target.value }))
                }
              />
              {profileErrors.email && (
                <p className="text-sm text-destructive">{profileErrors.email}</p>
              )}
            </div>

            <Button type="submit" disabled={updateProfileMutation.isPending}>
              {updateProfileMutation.isPending ? t('common.saving') : t('settings.saveProfile')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* 修改密码 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.changePassword')}</CardTitle>
          <CardDescription>
            使用强密码以保护账号安全
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="oldPassword">{t('settings.oldPassword')}</Label>
              <Input
                id="oldPassword"
                type="password"
                value={passwordForm.old_password}
                onChange={(e) =>
                  setPasswordForm((p) => ({ ...p, old_password: e.target.value }))
                }
              />
              {passwordErrors.old_password && (
                <p className="text-sm text-destructive">{passwordErrors.old_password}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">{t('settings.newPassword')}</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordForm.new_password}
                onChange={(e) =>
                  setPasswordForm((p) => ({ ...p, new_password: e.target.value }))
                }
              />
              {passwordErrors.new_password && (
                <p className="text-sm text-destructive">{passwordErrors.new_password}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmNewPassword">{t('settings.confirmNewPassword')}</Label>
              <Input
                id="confirmNewPassword"
                type="password"
                value={passwordForm.confirm_password}
                onChange={(e) =>
                  setPasswordForm((p) => ({ ...p, confirm_password: e.target.value }))
                }
              />
              {passwordErrors.confirm_password && (
                <p className="text-sm text-destructive">{passwordErrors.confirm_password}</p>
              )}
            </div>

            <Button type="submit" disabled={changePasswordMutation.isPending}>
              {changePasswordMutation.isPending
                ? t('common.submitting')
                : t('settings.changePasswordBtn')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
