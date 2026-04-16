import client from './client'
import type { HostedRuleSet } from '@/types'

export const hostedRuleSetsApi = {
  list: async (): Promise<HostedRuleSet[]> => {
    const res = await client.get<{ code: number; data: HostedRuleSet[] }>('/hosted-rule-sets')
    return res.data.data
  },

  get: async (id: number): Promise<HostedRuleSet> => {
    const res = await client.get<{ code: number; data: HostedRuleSet }>(`/hosted-rule-sets/${id}`)
    return res.data.data
  },

  create: async (data: {
    name: string
    behavior: 'domain' | 'ipcidr' | 'classical'
    format: 'yaml' | 'text'
    content: string
  }): Promise<HostedRuleSet> => {
    const res = await client.post<{ code: number; data: HostedRuleSet }>('/hosted-rule-sets', data)
    return res.data.data
  },

  update: async (
    id: number,
    data: {
      name: string
      behavior: 'domain' | 'ipcidr' | 'classical'
      format: 'yaml' | 'text'
      content: string
    }
  ): Promise<HostedRuleSet> => {
    const res = await client.put<{ code: number; data: HostedRuleSet }>(`/hosted-rule-sets/${id}`, data)
    return res.data.data
  },

  delete: async (id: number): Promise<void> => {
    await client.delete(`/hosted-rule-sets/${id}`)
  },

  resetTokens: async (): Promise<void> => {
    await client.post('/hosted-rule-sets/reset-tokens')
  },
}
