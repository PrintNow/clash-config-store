import client from './client'
import type { DashboardStats } from '@/types'

export const dashboardApi = {
  // 获取仪表盘统计数据
  getStats: async (): Promise<DashboardStats> => {
    const res = await client.get<{ code: number; data: DashboardStats }>('/dashboard/stats')
    return res.data.data
  },
}
