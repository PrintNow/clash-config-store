import { describe, expect, it } from 'vitest'
import {
  buildRuleAnalysis,
  canUseMatchType,
  hasMatchRule,
  insertRule,
  normalizeMatchRuleOrder,
  parseRule,
  parseRulesText,
  ruleToString,
} from './index'

describe('rules domain', () => {
  describe('parseRule / ruleToString', () => {
    it('解析并序列化普通规则', () => {
      const parsed = parseRule('DOMAIN, github.com , DIRECT')
      expect(parsed).toEqual({
        type: 'DOMAIN',
        payload: 'github.com',
        target: 'DIRECT',
        noResolve: false,
      })
      expect(ruleToString(parsed)).toBe('DOMAIN,github.com,DIRECT')
    })

    it('解析 MATCH 规则', () => {
      expect(parseRule('MATCH,PROXY')).toEqual({
        type: 'MATCH',
        payload: '',
        target: 'PROXY',
        noResolve: false,
      })
      expect(ruleToString({ type: 'match', payload: 'ignored', target: 'PROXY' })).toBe(
        'MATCH,PROXY'
      )
    })

    it('支持 payload 含逗号的规则', () => {
      const parsed = parseRule('DOMAIN-REGEX,^foo,bar$,PROXY')
      expect(parsed).toEqual({
        type: 'DOMAIN-REGEX',
        payload: '^foo,bar$',
        target: 'PROXY',
        noResolve: false,
      })
      expect(ruleToString(parsed)).toBe('DOMAIN-REGEX,^foo,bar$,PROXY')
    })

    it('解析并序列化带 no-resolve 的目标 IP 类规则', () => {
      const parsed = parseRule('IP-CIDR,10.0.0.0/8,DIRECT,no-resolve')
      expect(parsed).toEqual({
        type: 'IP-CIDR',
        payload: '10.0.0.0/8',
        target: 'DIRECT',
        noResolve: true,
      })
      expect(ruleToString(parsed)).toBe('IP-CIDR,10.0.0.0/8,DIRECT,no-resolve')
    })

    it('MATCH 忽略末尾 no-resolve 标记', () => {
      expect(parseRule('MATCH,PROXY,no-resolve')).toEqual({
        type: 'MATCH',
        payload: '',
        target: 'PROXY',
        noResolve: false,
      })
    })

    it('payload 含逗号的规则可带 no-resolve', () => {
      const parsed = parseRule('DOMAIN-REGEX,^a,b$,PROXY,no-resolve')
      expect(parsed).toEqual({
        type: 'DOMAIN-REGEX',
        payload: '^a,b$',
        target: 'PROXY',
        noResolve: true,
      })
      expect(ruleToString(parsed)).toBe('DOMAIN-REGEX,^a,b$,PROXY,no-resolve')
    })
  })

  describe('parseRulesText', () => {
    it('忽略空行和注释，并保留源行号', () => {
      expect(parseRulesText('\n# comment\nDOMAIN,a.com,DIRECT\n\nMATCH,PROXY')).toEqual({
        rules: ['DOMAIN,a.com,DIRECT', 'MATCH,PROXY'],
        lineNumbers: [3, 5],
      })
    })
  })

  describe('MATCH 规则约束', () => {
    it('识别是否已有 MATCH', () => {
      expect(hasMatchRule(['DOMAIN,a.com,DIRECT', 'MATCH,PROXY'])).toBe(true)
      expect(hasMatchRule(['DOMAIN,a.com,DIRECT'])).toBe(false)
    })

    it('普通规则插入顶部，MATCH 插入底部', () => {
      const rules = ['DOMAIN,old.com,DIRECT', 'MATCH,PROXY']
      expect(insertRule(rules, 'DOMAIN')).toEqual({
        rules: ['DOMAIN,example.com,DIRECT', 'DOMAIN,old.com,DIRECT', 'MATCH,PROXY'],
        insertIndex: 0,
        inserted: true,
      })
      expect(insertRule(['DOMAIN,old.com,DIRECT'], 'MATCH')).toEqual({
        rules: ['DOMAIN,old.com,DIRECT', 'MATCH,DIRECT'],
        insertIndex: 1,
        inserted: true,
      })
    })

    it('已有 MATCH 时不再插入新的 MATCH', () => {
      expect(insertRule(['DOMAIN,a.com,DIRECT', 'MATCH,PROXY'], 'MATCH')).toEqual({
        rules: ['DOMAIN,a.com,DIRECT', 'MATCH,PROXY'],
        insertIndex: 1,
        inserted: false,
      })
    })

    it('已有其他 MATCH 时禁止把当前规则改成 MATCH', () => {
      expect(canUseMatchType(['DOMAIN,a.com,DIRECT', 'MATCH,PROXY'], 0)).toBe(false)
      expect(canUseMatchType(['DOMAIN,a.com,DIRECT', 'MATCH,PROXY'], 1)).toBe(true)
    })

    it('把 MATCH 规则整理到最后', () => {
      expect(
        normalizeMatchRuleOrder(['MATCH,PROXY', 'DOMAIN,a.com,DIRECT', 'GEOIP,CN,DIRECT'])
      ).toEqual(['DOMAIN,a.com,DIRECT', 'GEOIP,CN,DIRECT', 'MATCH,PROXY'])
    })
  })

  describe('buildRuleAnalysis', () => {
    const baseContext = {
      availableTargets: new Set(['DIRECT', 'PROXY']),
      availableRuleProviders: new Set(['apple', 'proxy']),
      selectedRuleProviders: new Set(['apple']),
      duplicateCount: 1,
      isLastRule: true,
    }

    it('当 MATCH 不在最后时给出警告', () => {
      const result = buildRuleAnalysis('MATCH,PROXY', {
        ...baseContext,
        isLastRule: false,
      })
      expect(result.status).toBe('warning')
      expect(result.warnings).toContain('MATCH 建议保持在规则列表最后')
    })

    it('最后一条 MATCH 不报警告', () => {
      const result = buildRuleAnalysis('MATCH,PROXY', baseContext)
      expect(result.status).toBe('valid')
      expect(result.warnings).toEqual([])
    })

    it('未勾选的 RULE-SET 给出警告', () => {
      const result = buildRuleAnalysis('RULE-SET,proxy,PROXY', baseContext)
      expect(result.status).toBe('warning')
      expect(result.warnings).toContain('规则集 "proxy" 尚未在“规则集引用”中勾选')
    })

    it('不存在的 RULE-SET 给出错误', () => {
      const result = buildRuleAnalysis('RULE-SET,missing,PROXY', baseContext)
      expect(result.status).toBe('error')
      expect(result.errors).toContain('规则集 "missing" 不存在')
    })

    it('缺失目标策略和重复规则会被检测', () => {
      const result = buildRuleAnalysis('DOMAIN,a.com,', {
        ...baseContext,
        duplicateCount: 2,
      })
      expect(result.status).toBe('error')
      expect(result.errors).toContain('缺少目标策略')
      expect(result.warnings).toContain('存在 2 条完全相同的规则')
    })

    it('不存在的目标策略给出警告', () => {
      const result = buildRuleAnalysis('DOMAIN,a.com,OTHER', baseContext)
      expect(result.status).toBe('warning')
      expect(result.warnings).toContain('目标策略 "OTHER" 当前不存在于内置策略、代理组或节点中')
    })

    it('非目标 IP 类规则带 no-resolve 时给出警告', () => {
      const result = buildRuleAnalysis('DOMAIN,a.com,DIRECT,no-resolve', baseContext)
      expect(result.status).toBe('warning')
      expect(result.warnings.some((w) => w.includes('no-resolve'))).toBe(true)
    })
  })
})
