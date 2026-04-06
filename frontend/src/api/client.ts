import axios from 'axios'
import { toast } from 'sonner'

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
      return Promise.reject(new Error(data.message || '操作失败'))
    }
    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      // 未授权，清除 token 并跳转登录
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
      return Promise.reject(new Error('未授权，请重新登录'))
    }

    const message =
      error.response?.data?.message || error.message || '网络错误，请稍后重试'

    toast.error(message)
    return Promise.reject(new Error(message))
  }
)

export default client
