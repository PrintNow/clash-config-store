import client from './client'
import type { Subscription, AccessRestriction, AccessLog } from '@/types'

interface SubscriptionPayload {
  name?: string
  enabled_provider_ids?: number[]
  custom_config_id?: number | null
  rule_insert_mode?: 'prepend' | 'append' | 'replace'
  proxy_prefix_enabled?: boolean
  base_config?: string
  token_expired_at?: string | null
}

interface AccessLogParams {
  page?: number
  page_size?: number
}

interface AccessLogResponse {
  items: AccessLog[]
  total: number
  page: number
  page_size: number
}

export const subscriptionsApi = {
  // 获取订阅列表
  list: async (): Promise<Subscription[]> => {
    const res = await client.get<{ code: number; data: Subscription[] }>('/subscriptions')
    return res.data.data
  },

  // 获取单个订阅（含 restrictions）
  get: async (id: number): Promise<Subscription> => {
    const res = await client.get<{ code: number; data: Subscription }>(`/subscriptions/${id}`)
    return res.data.data
  },

  // 创建订阅
  create: async (data: SubscriptionPayload): Promise<Subscription> => {
    const res = await client.post<{ code: number; data: Subscription }>('/subscriptions', data)
    return res.data.data
  },

  // 更新订阅
  update: async (id: number, data: SubscriptionPayload): Promise<Subscription> => {
    const res = await client.put<{ code: number; data: Subscription }>(
      `/subscriptions/${id}`,
      data
    )
    return res.data.data
  },

  // 删除订阅
  delete: async (id: number): Promise<void> => {
    await client.delete(`/subscriptions/${id}`)
  },

  // 重新生成 Token
  regenerateToken: async (id: number): Promise<Subscription> => {
    const res = await client.post<{ code: number; data: Subscription }>(
      `/subscriptions/${id}/regenerate-token`
    )
    return res.data.data
  },

  // 获取访问日志
  getAccessLogs: async (id: number, params?: AccessLogParams): Promise<AccessLogResponse> => {
    const res = await client.get<{ code: number; data: AccessLogResponse }>(
      `/subscriptions/${id}/access-logs`,
      { params }
    )
    return res.data.data
  },

  // 获取访问限制列表
  getRestrictions: async (id: number): Promise<AccessRestriction[]> => {
    const res = await client.get<{ code: number; data: AccessRestriction[] }>(
      `/subscriptions/${id}/restrictions`
    )
    return res.data.data
  },

  // 添加访问限制
  addRestriction: async (
    id: number,
    data: {
      type: 'ip' | 'cidr' | 'country' | 'city'
      value: string
      mode: 'allow' | 'deny'
    }
  ): Promise<AccessRestriction> => {
    const res = await client.post<{ code: number; data: AccessRestriction }>(
      `/subscriptions/${id}/restrictions`,
      data
    )
    return res.data.data
  },

  // 删除访问限制
  deleteRestriction: async (subscriptionId: number, restrictionId: number): Promise<void> => {
    await client.delete(`/subscriptions/${subscriptionId}/restrictions/${restrictionId}`)
  },
}
