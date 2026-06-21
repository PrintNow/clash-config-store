import client from './client'
import type { Provider } from '@/types'

type HttpProviderData = {
  name: string
  type: 'http'
  url: string
  user_agent_id?: number
  cache_ttl?: number
  filter?: string
  exclude_filter?: string
  prefix?: string
  suffix?: string
}

type InlineProviderData = {
  name: string
  type: 'inline'
  payload?: Record<string, unknown>[]
}

type CreateProviderData = HttpProviderData | InlineProviderData

export const providersApi = {
  list: async (): Promise<Provider[]> => {
    const res = await client.get<{ code: number; data: Provider[] }>('/providers')
    return res.data.data
  },
  create: async (data: CreateProviderData): Promise<Provider> => {
    const res = await client.post<{ code: number; data: Provider }>('/providers', data)
    return res.data.data
  },
  update: async (id: number, data: CreateProviderData): Promise<Provider> => {
    const res = await client.put<{ code: number; data: Provider }>(`/providers/${id}`, data)
    return res.data.data
  },
  delete: async (id: number): Promise<void> => {
    await client.delete(`/providers/${id}`)
  },
  refresh: async (id: number): Promise<void> => {
    await client.post(`/providers/${id}/refresh`)
  },
  // inline provider 节点管理
  getNodes: async (id: number): Promise<Record<string, unknown>[]> => {
    const res = await client.get<{ code: number; data: Record<string, unknown>[] | null }>(`/providers/${id}/nodes`)
    return res.data.data ?? []
  },
  addNode: async (id: number, node: Record<string, unknown>): Promise<Record<string, unknown>[]> => {
    const res = await client.post<{ code: number; data: Record<string, unknown>[] | null }>(`/providers/${id}/nodes`, node)
    return res.data.data ?? []
  },
  updateNode: async (id: number, nodeIndex: number, node: Record<string, unknown>): Promise<Record<string, unknown>[]> => {
    const res = await client.put<{ code: number; data: Record<string, unknown>[] | null }>(`/providers/${id}/nodes/${nodeIndex}`, node)
    return res.data.data ?? []
  },
  deleteNode: async (id: number, nodeIndex: number): Promise<Record<string, unknown>[]> => {
    const res = await client.delete<{ code: number; data: Record<string, unknown>[] | null }>(`/providers/${id}/nodes/${nodeIndex}`)
    return res.data.data ?? []
  },
}
