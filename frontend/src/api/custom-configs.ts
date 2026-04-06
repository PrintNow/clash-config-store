import client from './client'
import type { CustomConfig } from '@/types'

export const customConfigsApi = {
  // 获取规则集列表
  list: async (): Promise<CustomConfig[]> => {
    const res = await client.get<{ code: number; data: CustomConfig[] }>('/custom-configs')
    return res.data.data
  },

  // 获取单个规则集
  get: async (id: number): Promise<CustomConfig> => {
    const res = await client.get<{ code: number; data: CustomConfig }>(`/custom-configs/${id}`)
    return res.data.data
  },

  // 创建规则集
  create: async (data: {
    name: string
    proxies?: string
    proxy_groups?: string
    rules?: string
  }): Promise<CustomConfig> => {
    const res = await client.post<{ code: number; data: CustomConfig }>('/custom-configs', data)
    return res.data.data
  },

  // 更新规则集
  update: async (
    id: number,
    data: {
      name?: string
      proxies?: string
      proxy_groups?: string
      rules?: string
    }
  ): Promise<CustomConfig> => {
    const res = await client.put<{ code: number; data: CustomConfig }>(
      `/custom-configs/${id}`,
      data
    )
    return res.data.data
  },

  // 删除规则集
  delete: async (id: number): Promise<void> => {
    await client.delete(`/custom-configs/${id}`)
  },
}
