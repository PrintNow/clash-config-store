import client from './client'
import type { RuleSet } from '@/types'

type CreateRuleSetData = {
  source_type: 'external' | 'hosted'
  name: string
  behavior: string
  format: string
  url?: string
  interval?: number
  content?: string
}

export const ruleSetsApi = {
  list: async (sourceType?: 'external' | 'hosted'): Promise<RuleSet[]> => {
    const params = sourceType ? { source_type: sourceType } : {}
    const res = await client.get<{ code: number; data: RuleSet[] }>('/rule-sets', { params })
    return res.data.data
  },
  create: async (data: CreateRuleSetData): Promise<RuleSet> => {
    const res = await client.post<{ code: number; data: RuleSet }>('/rule-sets', data)
    return res.data.data
  },
  update: async (id: number, data: CreateRuleSetData): Promise<RuleSet> => {
    const res = await client.put<{ code: number; data: RuleSet }>(`/rule-sets/${id}`, data)
    return res.data.data
  },
  delete: async (id: number): Promise<void> => {
    await client.delete(`/rule-sets/${id}`)
  },
}
