import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AlertCircle } from 'lucide-react'
import { authApi } from '@/api/auth'
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

export function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({})

  // 页面挂载时预加载 RSA 公钥并缓存，减少登录时的等待
  useEffect(() => {
    preloadPublicKey().catch(() => {
      setErrors({ form: t('errors.publicKeyFailed') })
    })
  }, [t])

  const validate = () => {
    const newErrors: typeof errors = {}
    if (!email) newErrors.email = t('auth.emailRequired')
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = t('auth.emailInvalid')
    if (!password) newErrors.password = t('auth.passwordRequired')
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    setErrors({})
    try {
      const { token } = await authApi.login({ email, password })
      // 先写入 token，再从服务端拉取最新用户信息
      localStorage.setItem('token', token)
      const freshUser = await userApi.getProfile()
      setAuth(token, freshUser)
      toast.success(t('auth.loginSuccess'))
      navigate('/dashboard')
    } catch (err) {
      // 登录/注册错误不走 toast，直接展示在表单内
      const message = err instanceof Error ? err.message : t('errors.invalidCredentials')
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
              <CardTitle className="text-2xl">{t('auth.loginTitle')}</CardTitle>
              <CardDescription>{t('auth.loginSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* 服务端/网络级错误：用 Alert 组件内联展示，不弹 toast */}
                {errors.form && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{errors.form}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
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
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>

                <div className="space-y-2">
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

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? t('common.submitting') : t('auth.loginButton')}
                </Button>
              </form>

              <div className="mt-4 text-center text-sm text-muted-foreground">
                {t('auth.noAccount')}{' '}
                <Link to="/register" className="text-primary hover:underline">
                  {t('auth.goRegister')}
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
