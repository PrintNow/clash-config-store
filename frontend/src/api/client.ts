import axios, { type InternalAxiosRequestConfig } from 'axios'
import { toast } from 'sonner'
import i18n from '@/i18n'

/** 登录/注册请求不能与「会话失效」混用全局跳转 */
function isAuthRequest(config?: InternalAxiosRequestConfig): boolean {
  if (!config?.url) return false
  const path = config.url.split('?')[0]
  return (
    path === '/auth/login' ||
    path === 'auth/login' ||
    path.endsWith('/auth/login') ||
    path === '/auth/register' ||
    path === 'auth/register' ||
    path.endsWith('/auth/register')
  )
}

const client = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

// 请求拦截器：自动添加 Authorization header
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器：处理业务错误和 HTTP 错误
client.interceptors.response.use(
  (response) => {
    const data = response.data
    // 业务层错误（code 非零）
    if (data && typeof data === 'object' && 'code' in data && data.code !== 0) {
      const msg = data.message || i18n.t('errors.operationFailed')
      // 登录/注册的业务错误不 toast，由页面内联展示
      if (!isAuthRequest(response.config)) {
        toast.error(msg)
      }
      return Promise.reject(new Error(msg))
    }
    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      if (isAuthRequest(error.config)) {
        // 登录/注册 401：不 toast，由页面表单内展示错误
        const message =
          error.response?.data?.message || i18n.t('errors.invalidCredentials')
        return Promise.reject(new Error(message))
      }
      // 受保护接口会话失效：清除 token 并跳转登录
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
      return Promise.reject(new Error(i18n.t('errors.unauthorized')))
    }

    const message =
      error.response?.data?.message || error.message || i18n.t('errors.networkError')

    // 登录/注册请求的错误由页面内联展示
    if (!isAuthRequest(error.config)) {
      toast.error(message)
    }
    return Promise.reject(new Error(message))
  }
)

export default client
