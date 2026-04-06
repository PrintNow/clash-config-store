import client from './client'
import type { User } from '@/types'

export const userApi = {
  // 获取个人信息
  getProfile: async (): Promise<User> => {
    const res = await client.get<{ code: number; data: User }>('/user/profile')
    return res.data.data
  },

  // 更新个人信息
  updateProfile: async (data: { name: string; email: string }): Promise<User> => {
    const res = await client.put<{ code: number; data: User }>('/user/profile', data)
    return res.data.data
  },

  // 修改密码
  changePassword: async (data: {
    old_password: string
    new_password: string
  }): Promise<void> => {
    await client.put('/user/password', data)
  },
}
