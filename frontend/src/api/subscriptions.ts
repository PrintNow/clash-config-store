import client from './client'
import { withParsedEnabledProviderIds } from '@/domain/subscription/enabledProviderIds'
import type { Subscription, AccessRestriction, AccessLog } from '@/types'

interface SubscriptionPayload {
  name?: string
  enabled_provider_ids?: number[]
  custom_config_id?: number | null
  config_template_id?: number | null
  rule_insert_mode?: 'prepend' | 'append' | 'replace'
  proxy_prefix_enabled?: boolean
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
  list: async (): Promise<Subscription[]> => {
    const res = await client.get<{ code: number; data: Subscription[] }>('/subscriptions')
    return res.data.data.map((s) => withParsedEnabledProviderIds(s))
  },

  get: async (id: number): Promise<Subscription> => {
    const res = await client.get<{
      code: number
      data: { subscription: Subscription; access_restrictions: AccessRestriction[] }
    }>(`/subscriptions/${id}`)
    return withParsedEnabledProviderIds(res.data.data.subscription)
  },

  getWithRestrictions: async (
    id: number
  ): Promise<{ subscription: Subscription; access_restrictions: AccessRestriction[] }> => {
    const res = await client.get<{
      code: number
      data: { subscription: Subscription; access_restrictions: AccessRestriction[] }
    }>(`/subscriptions/${id}`)
    return {
      subscription: withParsedEnabledProviderIds(res.data.data.subscription),
      access_restrictions: res.data.data.access_restrictions,
    }
  },

  create: async (data: SubscriptionPayload): Promise<Subscription> => {
    const res = await client.post<{ code: number; data: Subscription }>('/subscriptions', data)
    return withParsedEnabledProviderIds(res.data.data)
  },

  update: async (id: number, data: SubscriptionPayload): Promise<Subscription> => {
    const res = await client.put<{ code: number; data: Subscription }>(`/subscriptions/${id}`, data)
    return withParsedEnabledProviderIds(res.data.data)
  },

  delete: async (id: number): Promise<void> => {
    await client.delete(`/subscriptions/${id}`)
  },

  regenerateToken: async (id: number): Promise<{ token: string }> => {
    const res = await client.post<{ code: number; data: { token: string } }>(
      `/subscriptions/${id}/regenerate-token`
    )
    return res.data.data
  },

  getAccessLogs: async (id: number, params?: AccessLogParams): Promise<AccessLogResponse> => {
    const res = await client.get<{ code: number; data: AccessLogResponse }>(
      `/subscriptions/${id}/access-logs`,
      { params }
    )
    return res.data.data
  },

  getRestrictions: async (id: number): Promise<AccessRestriction[]> => {
    const res = await client.get<{ code: number; data: AccessRestriction[] }>(
      `/subscriptions/${id}/restrictions`
    )
    return res.data.data
  },

  addRestriction: async (
    id: number,
    data: { type: 'ip' | 'cidr' | 'country'; value: string; mode: 'allow' | 'deny' }
  ): Promise<AccessRestriction> => {
    const res = await client.post<{ code: number; data: AccessRestriction }>(
      `/subscriptions/${id}/restrictions`,
      data
    )
    return res.data.data
  },

  deleteRestriction: async (subscriptionId: number, restrictionId: number): Promise<void> => {
    await client.delete(`/subscriptions/${subscriptionId}/restrictions/${restrictionId}`)
  },
}
