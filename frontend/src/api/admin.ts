import client from './client'
import type { User } from '@/types'

export interface AdminUserListResponse {
  items: User[]
  total: number
  page: number
  page_size: number
}

export type SiteSettingsMap = Record<string, string>

export const adminApi = {
  /** 公开：是否允许注册 */
  getRegistrationStatus: async (): Promise<{ allowed: boolean }> => {
    const res = await client.get<{ code: number; data: { allowed: boolean } }>(
      '/public/registration-status'
    )
    return res.data.data
  },

  listUsers: async (page = 1, pageSize = 20): Promise<AdminUserListResponse> => {
    const res = await client.get<{ code: number; data: AdminUserListResponse }>('/admin/users', {
      params: { page, page_size: pageSize },
    })
    return res.data.data
  },

  updateUserRole: async (id: number, role: string): Promise<void> => {
    await client.patch(`/admin/users/${id}/role`, { role })
  },

  createUser: async (data: {
    email: string
    name?: string
    password: string
    role?: string
  }): Promise<User> => {
    const res = await client.post<{ code: number; data: User }>('/admin/users', data)
    return res.data.data
  },

  updateUser: async (
    id: number,
    data: { name?: string; email?: string; password?: string }
  ): Promise<User> => {
    const res = await client.put<{ code: number; data: User }>(`/admin/users/${id}`, data)
    return res.data.data
  },

  deleteUser: async (id: number): Promise<void> => {
    await client.delete(`/admin/users/${id}`)
  },

  getSettings: async (): Promise<SiteSettingsMap> => {
    const res = await client.get<{ code: number; data: SiteSettingsMap }>('/admin/settings')
    return res.data.data
  },

  updateSettings: async (allowRegistration: boolean): Promise<void> => {
    await client.put('/admin/settings', { allow_registration: allowRegistration })
  },
}
