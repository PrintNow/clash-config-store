import { describe, expect, it } from 'vitest'
import {
  buildRuleAnalysis,
  canUseMatchType,
  COMMA_PAYLOAD_RULE_TYPES,
  hasMatchRule,
  insertRule,
  normalizeMatchRuleOrder,
  normalizeRuleType,
  parseRule,
  parseRulesText,
  ruleSupportsNoResolve,
  ruleToString,
  RULE_TYPES,
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

    it('解析并序列化带 no-resolve 的 RULE-SET 规则', () => {
      const parsed = parseRule('RULE-SET,apple,PROXY,no-resolve')
      expect(parsed).toEqual({
        type: 'RULE-SET',
        payload: 'apple',
        target: 'PROXY',
        noResolve: true,
      })
      expect(ruleToString(parsed)).toBe('RULE-SET,apple,PROXY,no-resolve')
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
      expect(result.warnings).toContainEqual({ key: 'customConfigs.ruleAnalysis.matchShouldBeLast' })
    })

    it('最后一条 MATCH 不报警告', () => {
      const result = buildRuleAnalysis('MATCH,PROXY', baseContext)
      expect(result.status).toBe('valid')
      expect(result.warnings).toEqual([])
    })

    it('未勾选的 RULE-SET 给出警告', () => {
      const result = buildRuleAnalysis('RULE-SET,proxy,PROXY', baseContext)
      expect(result.status).toBe('warning')
      expect(result.warnings).toContainEqual({
        key: 'customConfigs.ruleAnalysis.ruleSetNotSelected',
        params: { name: 'proxy' },
      })
    })

    it('不存在的 RULE-SET 给出错误', () => {
      const result = buildRuleAnalysis('RULE-SET,missing,PROXY', baseContext)
      expect(result.status).toBe('error')
      expect(result.errors).toContainEqual({
        key: 'customConfigs.ruleAnalysis.ruleSetNotFound',
        params: { name: 'missing' },
      })
    })

    it('缺失目标策略和重复规则会被检测', () => {
      const result = buildRuleAnalysis('DOMAIN,a.com,', {
        ...baseContext,
        duplicateCount: 2,
      })
      expect(result.status).toBe('error')
      expect(result.errors).toContainEqual({ key: 'customConfigs.ruleAnalysis.missingTarget' })
      expect(result.warnings).toContainEqual({
        key: 'customConfigs.ruleAnalysis.duplicateRules',
        params: { count: 2 },
      })
    })

    it('不存在的目标策略给出警告', () => {
      const result = buildRuleAnalysis('DOMAIN,a.com,OTHER', baseContext)
      expect(result.status).toBe('warning')
      expect(result.warnings).toContainEqual({
        key: 'customConfigs.ruleAnalysis.targetNotFound',
        params: { name: 'OTHER' },
      })
    })

    it('非目标 IP 类规则带 no-resolve 时给出警告', () => {
      const result = buildRuleAnalysis('DOMAIN,a.com,DIRECT,no-resolve', baseContext)
      expect(result.status).toBe('warning')
      expect(result.warnings.some((w) => w.key === 'customConfigs.ruleAnalysis.noResolveUnsupported')).toBe(true)
    })

    it('RULE-SET 带 no-resolve 且已选规则集时不因 no-resolve 产生类型警告', () => {
      const result = buildRuleAnalysis('RULE-SET,apple,PROXY,no-resolve', {
        ...baseContext,
        selectedRuleProviders: new Set(['apple']),
      })
      expect(result.status).toBe('valid')
      expect(result.parsed.noResolve).toBe(true)
      expect(
        result.warnings.some((w) => w.key === 'customConfigs.ruleAnalysis.noResolveUnsupported')
      ).toBe(false)
    })

    it('空规则字符串报错', () => {
      const result = buildRuleAnalysis('', baseContext)
      expect(result.status).toBe('error')
      expect(result.errors).toContainEqual({ key: 'customConfigs.ruleAnalysis.emptyRule' })
    })

    it('不支持的规则类型报错', () => {
      const result = buildRuleAnalysis('BANANA,payload,PROXY', baseContext)
      expect(result.status).toBe('error')
      expect(result.errors).toContainEqual({
        key: 'customConfigs.ruleAnalysis.unsupportedType',
        params: { type: 'BANANA' },
      })
    })

    it('非 MATCH 规则缺少 payload 报错', () => {
      const result = buildRuleAnalysis('DOMAIN,,DIRECT', baseContext)
      expect(result.status).toBe('error')
      expect(result.errors).toContainEqual({ key: 'customConfigs.ruleAnalysis.missingPayload' })
    })

    it('RULE-SET 已选且存在时无警告', () => {
      const result = buildRuleAnalysis('RULE-SET,apple,PROXY', {
        ...baseContext,
        selectedRuleProviders: new Set(['apple']),
      })
      expect(result.status).toBe('valid')
      expect(result.errors).toEqual([])
      expect(result.warnings).toEqual([])
    })
  })

  describe('normalizeRuleType', () => {
    it('将小写转换为大写', () => {
      expect(normalizeRuleType('domain')).toBe('DOMAIN')
    })

    it('去除首尾空格', () => {
      expect(normalizeRuleType('  IP-CIDR  ')).toBe('IP-CIDR')
    })

    it('空字符串返回空', () => {
      expect(normalizeRuleType('')).toBe('')
    })
  })

  describe('ruleSupportsNoResolve', () => {
    it('GEOIP 支持 no-resolve', () => {
      expect(ruleSupportsNoResolve('GEOIP')).toBe(true)
    })

    it('RULE-SET 支持 no-resolve', () => {
      expect(ruleSupportsNoResolve('RULE-SET')).toBe(true)
    })

    it('DOMAIN 不支持 no-resolve', () => {
      expect(ruleSupportsNoResolve('DOMAIN')).toBe(false)
    })

    it('大小写不敏感', () => {
      expect(ruleSupportsNoResolve('ip-cidr')).toBe(true)
    })

    it('SRC-GEOIP 不支持', () => {
      expect(ruleSupportsNoResolve('SRC-GEOIP')).toBe(false)
    })
  })

  describe('insertRule 模板', () => {
    it('DOMAIN-SUFFIX 模板插入顶部', () => {
      const result = insertRule(['MATCH,PROXY'], 'DOMAIN-SUFFIX')
      expect(result.inserted).toBe(true)
      expect(result.insertIndex).toBe(0)
      expect(result.rules[0]).toBe('DOMAIN-SUFFIX,example.com,DIRECT')
    })

    it('RULE-SET 模板插入顶部', () => {
      const result = insertRule(['MATCH,PROXY'], 'RULE-SET')
      expect(result.inserted).toBe(true)
      expect(result.insertIndex).toBe(0)
      expect(result.rules[0]).toBe('RULE-SET,,DIRECT')
    })
  })

  describe('parseRule 边界', () => {
    it('空字符串返回空类型', () => {
      const result = parseRule('')
      expect(result.type).toBe('')
      expect(result.payload).toBe('')
    })

    it('仅类型无 payload 和 target', () => {
      const result = parseRule('DOMAIN')
      expect(result.type).toBe('DOMAIN')
      expect(result.target).toBe('')
    })
  })

  describe('ruleToString', () => {
    it('MATCH 规则忽略 payload', () => {
      expect(ruleToString({ type: 'MATCH', payload: 'ignored', target: 'PROXY' })).toBe(
        'MATCH,PROXY'
      )
    })
  })

  describe('normalizeMatchRuleOrder', () => {
    it('多条 MATCH 规则均移到最后', () => {
      expect(
        normalizeMatchRuleOrder(['MATCH,A', 'DOMAIN,x.com,DIRECT', 'MATCH,B'])
      ).toEqual(['DOMAIN,x.com,DIRECT', 'MATCH,A', 'MATCH,B'])
    })
  })

  describe('COMMA_PAYLOAD_RULE_TYPES 完整性', () => {
    it('包含所有 7 种类型', () => {
      const expected = [
        'NOT',
        'OR',
        'AND',
        'SUB-RULE',
        'DOMAIN-REGEX',
        'PROCESS-NAME-REGEX',
        'PROCESS-PATH-REGEX',
      ]
      for (const type of expected) {
        expect(COMMA_PAYLOAD_RULE_TYPES.has(type)).toBe(true)
      }
      expect(COMMA_PAYLOAD_RULE_TYPES.size).toBe(7)
    })
  })

  describe('FINAL 别名', () => {
    it('parseRule 将 FINAL 解析为 MATCH', () => {
      const result = parseRule('FINAL,PROXY')
      expect(result.type).toBe('MATCH')
      expect(result.target).toBe('PROXY')
      expect(result.noResolve).toBe(false)
    })

    it('ruleToString 对 FINAL 类型输出 MATCH', () => {
      expect(ruleToString({ type: 'FINAL', payload: '', target: 'PROXY' })).toBe('MATCH,PROXY')
    })

    it('FINAL 忽略 no-resolve（与 MATCH 一致）', () => {
      const result = parseRule('FINAL,PROXY,no-resolve')
      expect(result.type).toBe('MATCH')
      expect(result.noResolve).toBe(false)
    })
  })

  describe('RULE_TYPES 完整性', () => {
    it('包含 36 种规则类型', () => {
      expect(RULE_TYPES.length).toBe(36)
    })

    it('包含所有关键 Mihomo 类型', () => {
      const critical = [
        'DOMAIN',
        'DOMAIN-SUFFIX',
        'DOMAIN-KEYWORD',
        'GEOSITE',
        'GEOIP',
        'IP-CIDR',
        'IP-CIDR6',
        'RULE-SET',
        'MATCH',
        'PROCESS-NAME',
        'DST-PORT',
        'NETWORK',
        'SUB-RULE',
        'AND',
        'OR',
        'NOT',
      ]
      for (const type of critical) {
        expect(RULE_TYPES).toContain(type)
      }
    })
  })
})
