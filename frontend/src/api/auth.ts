import client from './client'
import type { User } from '@/types'

interface AuthResponse {
  token: string
  user: User
}

export const authApi = {
  // 注册
  register: async (data: {
    email: string
    name: string
    password: string
  }): Promise<AuthResponse> => {
    const res = await client.post<{ code: number; data: AuthResponse }>('/auth/register', data)
    return res.data.data
  },

  // 登录
  login: async (data: { email: string; password: string }): Promise<AuthResponse> => {
    const res = await client.post<{ code: number; data: AuthResponse }>('/auth/login', data)
    return res.data.data
  },
}
