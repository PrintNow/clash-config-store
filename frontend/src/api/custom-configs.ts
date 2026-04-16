import client from './client'
import type { CustomConfig, CustomConfigTransferPayload, ProxyNode, ProxyGroup } from '@/types'

export const customConfigsApi = {
  list: async (): Promise<CustomConfig[]> => {
    const res = await client.get<{ code: number; data: CustomConfig[] }>('/custom-configs')
    return res.data.data
  },

  get: async (id: number): Promise<CustomConfig> => {
    const res = await client.get<{ code: number; data: CustomConfig }>(`/custom-configs/${id}`)
    return res.data.data
  },

  create: async (data: {
    name: string
    proxies?: ProxyNode[]
    proxy_groups?: ProxyGroup[]
    rules?: string[]
    rule_provider_ids?: number[]
    hosted_rule_set_ids?: number[]
  }): Promise<CustomConfig> => {
    const res = await client.post<{ code: number; data: CustomConfig }>('/custom-configs', data)
    return res.data.data
  },

  update: async (
    id: number,
    data: {
      name: string
      proxies?: ProxyNode[]
      proxy_groups?: ProxyGroup[]
      rules?: string[]
      rule_provider_ids?: number[]
      hosted_rule_set_ids?: number[]
    }
  ): Promise<CustomConfig> => {
    const res = await client.put<{ code: number; data: CustomConfig }>(`/custom-configs/${id}`, data)
    return res.data.data
  },

  delete: async (id: number): Promise<void> => {
    await client.delete(`/custom-configs/${id}`)
  },

  clone: async (id: number): Promise<CustomConfig> => {
    const res = await client.post<{ code: number; data: CustomConfig }>(`/custom-configs/${id}/clone`)
    return res.data.data
  },

  export: async (id: number): Promise<Blob> => {
    const res = await client.get<Blob>(`/custom-configs/${id}/export`, {
      responseType: 'blob',
    })
    return res.data
  },

  import: async (data: CustomConfigTransferPayload): Promise<CustomConfig> => {
    const res = await client.post<{ code: number; data: CustomConfig }>('/custom-configs/import', data)
    return res.data.data
  },

  // 获取当前配置的 YAML 预览
  preview: async (id: number): Promise<string> => {
    const res = await client.get<string>(`/custom-configs/${id}/preview`, {
      responseType: 'text',
    })
    return res.data as unknown as string
  },
}
