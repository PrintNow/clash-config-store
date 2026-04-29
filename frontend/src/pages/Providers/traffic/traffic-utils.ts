/**
 * 将字节数格式化为可读字符串（KB/MB/GB/TB）。
 * 使用二进制单位（1 GB = 1024^3），网络流量通用标准。
 */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes <= 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let value = bytes
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(i === 0 ? 0 : 2)} ${units[i]}`
}

/**
 * 计算流量使用百分比: (upload + download) / total * 100
 * total 不可用或为 0 时返回 null。
 */
export function calcUsagePercent(
  upload: number | null | undefined,
  download: number | null | undefined,
  total: number | null | undefined
): number | null {
  if (total == null || total <= 0) return null
  const used = (upload ?? 0) + (download ?? 0)
  return Math.min(Math.round((used / total) * 100), 100)
}

/**
 * 将 ISO 日期字符串格式化为 YYYY-MM-DD 格式。
 * 输入为 null/undefined 或 Unix epoch 0 时返回 null。
 */
export function formatExpireDate(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null
  const d = new Date(isoDate)
  if (isNaN(d.getTime())) return null
  if (d.getTime() <= 0) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 计算剩余天数。返回 null 表示无到期信息；负数表示已过期。
 */
export function daysRemaining(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null
  const d = new Date(isoDate)
  if (isNaN(d.getTime()) || d.getTime() <= 0) return null
  return Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

/**
 * 判断订阅是否已过期。
 */
export function isExpired(isoDate: string | null | undefined): boolean {
  const days = daysRemaining(isoDate)
  return days !== null && days < 0
}
