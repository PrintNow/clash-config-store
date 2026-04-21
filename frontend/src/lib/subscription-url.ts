import type { Subscription } from '@/types'

/**
 * 统一生成订阅对外访问链接。
 * 开发环境走同源代理，生产环境优先使用后端返回的完整地址。
 */
export function subscriptionPublicUrl(
  sub: Pick<Subscription, 'token' | 'subscription_url'>
): string {
  if (import.meta.env.DEV) {
    return `${window.location.origin}/sub/${sub.token}`
  }

  return sub.subscription_url ?? `${window.location.origin}/sub/${sub.token}`
}
