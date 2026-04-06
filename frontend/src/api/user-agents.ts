import client from './client'
import type { UserAgent } from '@/types'

export const userAgentsApi = {
  // 获取 UA 列表
  list: async (): Promise<UserAgent[]> => {
    const res = await client.get<{ code: number; data: UserAgent[] }>('/user-agents')
    return res.data.data
  },

  // 创建 UA
  create: async (data: { name: string; value: string }): Promise<UserAgent> => {
    const res = await client.post<{ code: number; data: UserAgent }>('/user-agents', data)
    return res.data.data
  },

  // 更新 UA
  update: async (id: number, data: { name: string; value: string }): Promise<UserAgent> => {
    const res = await client.put<{ code: number; data: UserAgent }>(`/user-agents/${id}`, data)
    return res.data.data
  },

  // 删除 UA
  delete: async (id: number): Promise<void> => {
    await client.delete(`/user-agents/${id}`)
  },
}
