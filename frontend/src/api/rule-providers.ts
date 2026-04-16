import client from './client'
import type { RuleProvider } from '@/types'

export const ruleProvidersApi = {
  list: async (): Promise<RuleProvider[]> => {
    const res = await client.get<{ code: number; data: RuleProvider[] }>('/rule-providers')
    return res.data.data
  },

  get: async (id: number): Promise<RuleProvider> => {
    const res = await client.get<{ code: number; data: RuleProvider }>(`/rule-providers/${id}`)
    return res.data.data
  },

  create: async (data: {
    name: string
    type: 'http' | 'file'
    url?: string
    behavior: 'domain' | 'ipcidr' | 'classical'
    format?: 'yaml' | 'text' | 'mrs'
    interval?: number
  }): Promise<RuleProvider> => {
    const res = await client.post<{ code: number; data: RuleProvider }>('/rule-providers', data)
    return res.data.data
  },

  update: async (
    id: number,
    data: {
      name: string
      type: 'http' | 'file'
      url?: string
      behavior: 'domain' | 'ipcidr' | 'classical'
      format?: 'yaml' | 'text' | 'mrs'
      interval?: number
    }
  ): Promise<RuleProvider> => {
    const res = await client.put<{ code: number; data: RuleProvider }>(`/rule-providers/${id}`, data)
    return res.data.data
  },

  delete: async (id: number): Promise<void> => {
    await client.delete(`/rule-providers/${id}`)
  },
}
