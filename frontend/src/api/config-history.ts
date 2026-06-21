import client from './client'

export interface ConfigHistory {
  id: number
  custom_config_id: number
  name: string
  proxy_groups: Record<string, unknown>[]
  rules: string[]
  rule_provider_ids: number[]
  hosted_rule_set_ids: number[]
  created_at: string
}

export const configHistoryApi = {
  list: (configId: number) =>
    client
      .get<{ code: number; data: ConfigHistory[] }>(`/custom-configs/${configId}/history`)
      .then((r) => r.data.data),
  restore: (configId: number, historyId: number) =>
    client
      .post<{ code: number; data: unknown }>(`/custom-configs/${configId}/history/${historyId}/restore`)
      .then((r) => r.data.data),
}
