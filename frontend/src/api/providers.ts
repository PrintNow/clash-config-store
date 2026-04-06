import client from './client'
import type { Provider } from '@/types'

export const providersApi = {
  // 获取订阅源列表
  list: async (): Promise<Provider[]> => {
    const res = await client.get<{ code: number; data: Provider[] }>('/providers')
    return res.data.data
  },

  // 创建订阅源
  create: async (data: {
    name: string
    url: string
    user_agent_id?: number
    cache_ttl?: number
  }): Promise<Provider> => {
    const res = await client.post<{ code: number; data: Provider }>('/providers', data)
    return res.data.data
  },

  // 更新订阅源
  update: async (
    id: number,
    data: {
      name: string
      url: string
      user_agent_id?: number
      cache_ttl?: number
    }
  ): Promise<Provider> => {
    const res = await client.put<{ code: number; data: Provider }>(`/providers/${id}`, data)
    return res.data.data
  },

  // 删除订阅源
  delete: async (id: number): Promise<void> => {
    await client.delete(`/providers/${id}`)
  },

  // 手动刷新订阅源
  refresh: async (id: number): Promise<void> => {
    await client.post(`/providers/${id}/refresh`)
  },
}
