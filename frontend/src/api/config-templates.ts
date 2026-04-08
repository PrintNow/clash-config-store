import client from './client'
import type { ConfigTemplate } from '@/types'

export const configTemplatesApi = {
  list: async (): Promise<ConfigTemplate[]> => {
    const res = await client.get<{ code: number; data: ConfigTemplate[] }>('/config-templates')
    return res.data.data
  },

  get: async (id: number): Promise<ConfigTemplate> => {
    const res = await client.get<{ code: number; data: ConfigTemplate }>(`/config-templates/${id}`)
    return res.data.data
  },

  create: async (data: { name: string; description?: string; content?: string }): Promise<ConfigTemplate> => {
    const res = await client.post<{ code: number; data: ConfigTemplate }>('/config-templates', data)
    return res.data.data
  },

  update: async (id: number, data: { name: string; description?: string; content?: string }): Promise<ConfigTemplate> => {
    const res = await client.put<{ code: number; data: ConfigTemplate }>(`/config-templates/${id}`, data)
    return res.data.data
  },

  delete: async (id: number): Promise<void> => {
    await client.delete(`/config-templates/${id}`)
  },
}
