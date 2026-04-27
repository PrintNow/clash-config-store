import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AlertCircle } from 'lucide-react'
import { authApi } from '@/api/auth'
import { adminApi } from '@/api/admin'
import { userApi } from '@/api/user'
import { preloadPublicKey } from '@/api/crypto'
import { useAuthStore } from '@/store/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { BrandLogo } from '@/components/BrandLogo'
import { SiteFooter } from '@/components/layout/SiteFooter'

// 与后端 registerRequest Password binding:"min=6" 一致
const REGISTER_PASSWORD_MIN_LEN = 6

export function Register() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [registrationAllowed, setRegistrationAllowed] = useState<boolean | null>(null)
  const [errors, setErrors] = useState<{
    name?: string
    email?: string
    password?: string
    confirmPassword?: string
    form?: string
  }>({})

  // 页面挂载时预加载 RSA 公钥并缓存，减少注册时的等待
  useEffect(() => {
    preloadPublicKey().catch(() => {
      setErrors({ form: t('errors.publicKeyFailed') })
    })
  }, [t])

  useEffect(() => {
    let cancelled = false
    adminApi
      .getRegistrationStatus()
      .then((r) => {
        if (!cancelled) setRegistrationAllowed(r.allowed)
      })
      .catch(() => {
        if (!cancelled) setRegistrationAllowed(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const validate = () => {
    const newErrors: typeof errors = {}
    if (!email.trim()) newErrors.email = t('auth.emailRequired')
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = t('auth.emailInvalid')
    if (!password) newErrors.password = t('auth.passwordRequired')
    else if (password.length < REGISTER_PASSWORD_MIN_LEN) {
      newErrors.password = t('auth.passwordMinLength', { min: REGISTER_PASSWORD_MIN_LEN })
    }
    if (password !== confirmPassword) newErrors.confirmPassword = t('auth.passwordMismatch')
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    setErrors({})
    try {
      const { token } = await authApi.register({
        email,
        password,
        ...(name.trim() ? { name: name.trim() } : {}),
      })
      // 先写入 token，再从服务端拉取最新用户信息
      localStorage.setItem('token', token)
      const freshUser = await userApi.getProfile()
      setAuth(token, freshUser)
      toast.success(t('auth.registerSuccess'))
      navigate('/dashboard')
    } catch (err) {
      // 注册错误直接在表单内展示，不弹 toast
      const message = err instanceof Error ? err.message : t('errors.operationFailed')
      setErrors({ form: message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <BrandLogo className="mb-4 h-14 w-14 rounded-xl shadow-sm" title="" />
            <h1 className="text-2xl font-bold">{t('nav.brandName')}</h1>
          </div>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl">{t('auth.registerTitle')}</CardTitle>
              <CardDescription>{t('auth.registerSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              {registrationAllowed === null ? (
                <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
              ) : registrationAllowed === false ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{t('auth.registerClosed')}</AlertDescription>
                </Alert>
              ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* 服务端/网络级错误：用 Alert 组件内联展示，不弹 toast */}
                {errors.form && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errors.form}</AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-col gap-2">
                  <Label htmlFor="name">
                    {t('auth.username')}
                    <span className="text-muted-foreground font-normal">（{t('common.optional')}）</span>
                  </Label>
                  <Input
                    id="name"
                    placeholder={t('auth.usernameOptionalPlaceholder')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={loading}
                    className={errors.name ? 'border-destructive' : ''}
                    aria-invalid={!!errors.name}
                  />
                  <p className="text-muted-foreground text-xs">{t('auth.usernameOptionalHint')}</p>
                  {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="email">{t('auth.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('auth.emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className={errors.email ? 'border-destructive' : ''}
                    aria-invalid={!!errors.email}
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="password">{t('auth.password')}</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder={t('auth.passwordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loading}
                    className={errors.password ? 'border-destructive' : ''}
                    aria-invalid={!!errors.password}
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="confirmPassword">{t('auth.confirmPassword')}</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder={t('auth.confirmPasswordPlaceholder')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={loading}
                    className={errors.confirmPassword ? 'border-destructive' : ''}
                    aria-invalid={!!errors.confirmPassword}
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t('common.submitting') : t('auth.registerButton')}
                </Button>
              </form>
              )}

              <div className="mt-4 text-center text-sm text-muted-foreground">
                {t('auth.hasAccount')}{' '}
                <Link to="/login" className="text-primary hover:underline">
                  {t('auth.goLogin')}
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
