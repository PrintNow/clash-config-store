import { describe, expect, it } from 'vitest'
import {
  hasProxyOrGroupNameConflict,
  renameProxyOrGroupRefs,
} from './rename-refs'
import type { ProxyGroup, ProxyNode } from '@/types'

describe('renameProxyOrGroupRefs', () => {
  it('无变化时 old 与 new 相同或 old 为空', () => {
    const pg: ProxyGroup[] = [{ name: 'A', type: 'select', proxies: ['B'] }]
    const r = renameProxyOrGroupRefs('', 'X', {
      proxyGroups: pg,
      rules: [],
      rulesText: '',
      rulesTextMode: false,
    })
    expect(r.replaceCount).toBe(0)
    expect(r.proxyGroups).toBe(pg)

    const r2 = renameProxyOrGroupRefs('X', 'X', {
      proxyGroups: pg,
      rules: ['DOMAIN,a.com,PROXY'],
      rulesText: '',
      rulesTextMode: false,
    })
    expect(r2.replaceCount).toBe(0)
  })

  it('替换各组 proxies 中的成员名（全等）', () => {
    const proxyGroups: ProxyGroup[] = [
      { name: 'APPLE', type: 'select', proxies: ['PROXY'] },
      { name: 'OTHER', type: 'select', proxies: ['PROXY', 'DIRECT'] },
    ]
    const res = renameProxyOrGroupRefs('PROXY', 'MY-PROXY', {
      proxyGroups,
      rules: [],
      rulesText: '',
      rulesTextMode: false,
    })
    expect(res.replaceCount).toBe(2)
    expect(res.proxyGroups[0].proxies).toEqual(['MY-PROXY'])
    expect(res.proxyGroups[1].proxies).toEqual(['MY-PROXY', 'DIRECT'])
  })

  it('不替换子串', () => {
    const proxyGroups: ProxyGroup[] = [
      { name: 'G', type: 'select', proxies: ['PROXY-2'] },
    ]
    const res = renameProxyOrGroupRefs('PROXY', 'X', {
      proxyGroups,
      rules: [],
      rulesText: '',
      rulesTextMode: false,
    })
    expect(res.replaceCount).toBe(0)
    expect(res.proxyGroups[0].proxies).toEqual(['PROXY-2'])
  })

  it('表格模式：替换规则策略列', () => {
    const res = renameProxyOrGroupRefs('PROXY', 'P2', {
      proxyGroups: [],
      rules: ['DOMAIN,ex.com,PROXY', 'IP-CIDR,1.1.1.1/32,DIRECT', 'MATCH,PROXY'],
      rulesText: '',
      rulesTextMode: false,
    })
    expect(res.replaceCount).toBe(2)
    expect(res.rules).toEqual([
      'DOMAIN,ex.com,P2',
      'IP-CIDR,1.1.1.1/32,DIRECT',
      'MATCH,P2',
    ])
  })

  it('原文模式：按行替换 rulesText 并同步 rules', () => {
    const res = renameProxyOrGroupRefs('OLD', 'NEW', {
      proxyGroups: [],
      rules: ['STALE'],
      rulesText: 'DOMAIN,x.com,OLD\n\n# c\nMATCH,OLD',
      rulesTextMode: true,
    })
    expect(res.rulesText).toBe('DOMAIN,x.com,NEW\n\n# c\nMATCH,NEW')
    expect(res.rules).toEqual(['DOMAIN,x.com,NEW', '# c', 'MATCH,NEW'])
    expect(res.replaceCount).toBe(2)
  })
})

describe('hasProxyOrGroupNameConflict', () => {
  const proxies: ProxyNode[] = [{ name: 'n1', type: 'ss', server: 's', port: 1 }]
  const groups: ProxyGroup[] = [{ name: 'G1', type: 'select' }]

  it('与已有代理名冲突', () => {
    expect(hasProxyOrGroupNameConflict('n1', proxies, groups)).toBe(true)
  })

  it('与已有组名冲突', () => {
    expect(hasProxyOrGroupNameConflict('G1', proxies, groups)).toBe(true)
  })

  it('排除当前代理下标时不视为冲突', () => {
    expect(hasProxyOrGroupNameConflict('n1', proxies, groups, { kind: 'proxy', index: 0 })).toBe(
      false
    )
  })

  it('排除当前组下标', () => {
    expect(hasProxyOrGroupNameConflict('G1', proxies, groups, { kind: 'group', index: 0 })).toBe(
      false
    )
  })
})
