import client from './client'
import type { DashboardStats } from '@/types'

export const dashboardApi = {
  getStats: async (): Promise<DashboardStats> => {
    const res = await client.get<{ code: number; data: DashboardStats }>('/dashboard/stats')
    return res.data.data
  },

  refreshAllProviders: async (): Promise<{ count: number }> => {
    const res = await client.post<{ code: number; data: { count: number } }>(
      '/dashboard/refresh-all-providers'
    )
    return res.data.data
  },
}
