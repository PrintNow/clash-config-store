import client from './client'
import { encryptPassword } from './crypto'
import type { User } from '@/types'

export interface AuthResponse {
  token: string
  user: User
}

export const authApi = {
  // 注册（密码用 RSA 公钥加密后传输）
  register: async (data: {
    email: string
    name?: string
    password: string
  }): Promise<AuthResponse> => {
    const encrypted_password = await encryptPassword(data.password)
    const res = await client.post<{ code: number; data: AuthResponse }>('/auth/register', {
      email: data.email,
      name: data.name?.trim() ?? '',
      encrypted_password,
    })
    return res.data.data
  },

  // 登录（密码用 RSA 公钥加密后传输）
  login: async (data: { email: string; password: string }): Promise<AuthResponse> => {
    const encrypted_password = await encryptPassword(data.password)
    const res = await client.post<{ code: number; data: AuthResponse }>('/auth/login', {
      email: data.email,
      encrypted_password,
    })
    return res.data.data
  },
}
