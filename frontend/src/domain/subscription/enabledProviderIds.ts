import type { Subscription } from '@/types'

/**
 * 将接口返回的 enabled_provider_ids（JSON 字符串或数组）规范为 number[]
 * 与后端 model.Subscription.EnabledProviderIDs 文本列 + JSON 序列化行为对齐
 */
export function parseEnabledProviderIds(raw: unknown): number[] {
  if (raw == null) return []
  if (Array.isArray(raw)) {
    return raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n >= 0)
  }
  if (typeof raw === 'string') {
    const t = raw.trim()
    if (!t || t === 'null') return []
    try {
      return parseEnabledProviderIds(JSON.parse(t))
    } catch {
      return []
    }
  }
  return []
}

/** 将 API 返回的订阅对象中的 enabled_provider_ids 转为数组（应用层适配） */
export function withParsedEnabledProviderIds(
  s: Subscription & { enabled_provider_ids?: unknown }
): Subscription {
  return {
    ...s,
    enabled_provider_ids: parseEnabledProviderIds(s.enabled_provider_ids),
  }
}
