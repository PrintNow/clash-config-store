import { describe, expect, it } from 'vitest'
import { parseEnabledProviderIds, withParsedEnabledProviderIds } from './enabledProviderIds'
import type { Subscription } from '@/types'

describe('parseEnabledProviderIds', () => {
  it('null/undefined 为空数组', () => {
    expect(parseEnabledProviderIds(null)).toEqual([])
    expect(parseEnabledProviderIds(undefined)).toEqual([])
  })

  it('解析 JSON 数组字符串', () => {
    expect(parseEnabledProviderIds('[1,2,3]')).toEqual([1, 2, 3])
  })

  it('数组元素可为字符串数字', () => {
    expect(parseEnabledProviderIds(['1', 2, '3'])).toEqual([1, 2, 3])
  })

  it('过滤非有限数字', () => {
    expect(parseEnabledProviderIds([1, NaN, 2, Infinity])).toEqual([1, 2])
  })

  it('非法 JSON 字符串返回空', () => {
    expect(parseEnabledProviderIds('not-json')).toEqual([])
  })

  it('"null" 与空串视为空', () => {
    expect(parseEnabledProviderIds('null')).toEqual([])
    expect(parseEnabledProviderIds('   ')).toEqual([])
  })
})

describe('withParsedEnabledProviderIds', () => {
  it('保留其他字段并覆盖 enabled_provider_ids', () => {
    const raw = {
      id: 1,
      user_id: 1,
      name: 's',
      token: 't',
      enabled_provider_ids: '[10,20]',
      rule_insert_mode: 'append' as const,
      proxy_prefix_enabled: false,
      base_config: '{}',
      created_at: '2020-01-01',
    } as unknown as Subscription & { enabled_provider_ids: unknown }

    const out = withParsedEnabledProviderIds(raw)
    expect(out.enabled_provider_ids).toEqual([10, 20])
    expect(out.name).toBe('s')
  })
})
