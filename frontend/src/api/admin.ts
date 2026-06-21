import client from './client'

export interface AdminUser {
  id: number
  name: string
  email: string
  is_admin: boolean
  created_at: string
  provider_count: number
  subscription_count: number
  custom_config_count: number
}

export interface SystemSettings {
  allow_registration: boolean
  base_url: string
  default_token_expiry_days: number
}

export const adminApi = {
  getSettings: async (): Promise<SystemSettings> => {
    const res = await client.get<{ code: number; data: SystemSettings }>('/admin/settings')
    return res.data.data
  },

  updateSettings: async (data: SystemSettings): Promise<SystemSettings> => {
    const res = await client.put<{ code: number; data: SystemSettings }>('/admin/settings', data)
    return res.data.data
  },

  listUsers: async (): Promise<AdminUser[]> => {
    const res = await client.get<{ code: number; data: AdminUser[] }>('/admin/users')
    return res.data.data
  },

  getUser: async (id: number): Promise<AdminUser> => {
    const res = await client.get<{ code: number; data: AdminUser }>(`/admin/users/${id}`)
    return res.data.data
  },

  updateUser: async (
    id: number,
    data: { name?: string; email?: string; is_admin?: boolean; password?: string }
  ): Promise<AdminUser> => {
    const res = await client.put<{ code: number; data: AdminUser }>(`/admin/users/${id}`, data)
    return res.data.data
  },

  createUser: async (data: {
    name: string
    email: string
    password: string
    is_admin: boolean
  }): Promise<AdminUser> => {
    const res = await client.post<{ code: number; data: AdminUser }>('/admin/users', data)
    return res.data.data
  },

  deleteUser: async (id: number): Promise<void> => {
    await client.delete(`/admin/users/${id}`)
  },
}
