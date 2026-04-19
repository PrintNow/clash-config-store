export interface ParsedRule {
  type: string
  payload: string
  target: string
  /** 末尾附加 `,no-resolve`（仅对部分目标 IP 类规则有意义） */
  noResolve?: boolean
}

export interface ParsedRulesTextResult {
  rules: string[]
  lineNumbers: number[]
}

export interface RuleAnalysis {
  rule: string
  parsed: ParsedRule
  status: 'valid' | 'warning' | 'error'
  errors: string[]
  warnings: string[]
  quickFixes: RuleQuickFix[]
}

export type RuleQuickFixAction =
  | 'move-match-to-bottom'
  | 'go-rule-sets'
  | 'go-target-groups'
  | 'go-target-proxies'

export interface RuleQuickFix {
  type: RuleQuickFixAction
  label: string
}

export const RULE_TYPES = [
  'DOMAIN',
  'DOMAIN-SUFFIX',
  'DOMAIN-KEYWORD',
  'DOMAIN-REGEX',
  'DOMAIN-WILDCARD',
  'GEOSITE',
  'GEOIP',
  'SRC-GEOIP',
  'IP-ASN',
  'SRC-IP-ASN',
  'IP-CIDR',
  'IP-CIDR6',
  'SRC-IP-CIDR',
  'IP-SUFFIX',
  'SRC-IP-SUFFIX',
  'SRC-PORT',
  'DST-PORT',
  'IN-PORT',
  'DSCP',
  'PROCESS-NAME',
  'PROCESS-PATH',
  'PROCESS-NAME-REGEX',
  'PROCESS-PATH-REGEX',
  'PROCESS-NAME-WILDCARD',
  'PROCESS-PATH-WILDCARD',
  'NETWORK',
  'UID',
  'IN-TYPE',
  'IN-USER',
  'IN-NAME',
  'SUB-RULE',
  'AND',
  'OR',
  'NOT',
  'RULE-SET',
  'MATCH',
] as const

export const COMMA_PAYLOAD_RULE_TYPES = new Set([
  'NOT',
  'OR',
  'AND',
  'SUB-RULE',
  'DOMAIN-REGEX',
  'PROCESS-NAME-REGEX',
  'PROCESS-PATH-REGEX',
])

export const RULE_TEMPLATE_MAP: Record<'DOMAIN' | 'DOMAIN-SUFFIX' | 'RULE-SET' | 'MATCH', ParsedRule> = {
  DOMAIN: { type: 'DOMAIN', payload: 'example.com', target: 'DIRECT' },
  'DOMAIN-SUFFIX': { type: 'DOMAIN-SUFFIX', payload: 'example.com', target: 'DIRECT' },
  'RULE-SET': { type: 'RULE-SET', payload: '', target: 'DIRECT' },
  MATCH: { type: 'MATCH', payload: '', target: 'DIRECT' },
}

export function normalizeRuleType(type: string): string {
  return type.trim().toUpperCase()
}

/** Mihomo：域名匹配走目标 IP 类规则时会触发解析；no-resolve 可跳过 DNS 解析 */
export const NO_RESOLVE_RULE_TYPES = new Set<string>([
  'GEOIP',
  'IP-CIDR',
  'IP-CIDR6',
  'IP-SUFFIX',
  'IP-ASN',
])

export function ruleSupportsNoResolve(ruleType: string): boolean {
  return NO_RESOLVE_RULE_TYPES.has(normalizeRuleType(ruleType))
}

export function parseRule(rule: string): ParsedRule {
  const rawParts = rule.split(',').map((s) => s.trim())
  let noResolve = false
  let parts = rawParts
  if (parts.length > 0 && parts[parts.length - 1]?.toLowerCase() === 'no-resolve') {
    noResolve = true
    parts = parts.slice(0, -1)
  }
  const type = normalizeRuleType(parts[0] || '')
  if (type === 'MATCH') {
    return { type: 'MATCH', payload: '', target: parts[1] || '', noResolve: false }
  }
  if (COMMA_PAYLOAD_RULE_TYPES.has(type)) {
    return {
      type,
      payload: parts.slice(1, -1).join(','),
      target: parts.at(-1) || '',
      noResolve,
    }
  }
  return { type, payload: parts[1] || '', target: parts[2] || '', noResolve }
}

export function ruleToString(r: ParsedRule): string {
  const type = normalizeRuleType(r.type)
  const nr = r.noResolve ? ',no-resolve' : ''
  if (type === 'MATCH') return `MATCH,${r.target.trim()}`
  if (COMMA_PAYLOAD_RULE_TYPES.has(type)) {
    return `${type},${r.payload.trim()},${r.target.trim()}${nr}`
  }
  return `${type},${r.payload.trim()},${r.target.trim()}${nr}`
}

export function parseRulesText(text: string): ParsedRulesTextResult {
  const rules: string[] = []
  const lineNumbers: number[] = []
  const lines = text.split('\n')
  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    rules.push(trimmed)
    lineNumbers.push(index + 1)
  })
  return { rules, lineNumbers }
}

export function hasMatchRule(rules: string[]): boolean {
  return rules.some((rule) => parseRule(rule).type === 'MATCH')
}

export function canUseMatchType(rules: string[], currentIndex: number): boolean {
  return !rules.some((rule, index) => index !== currentIndex && parseRule(rule).type === 'MATCH')
}

export function insertRule(
  rules: string[],
  template: keyof typeof RULE_TEMPLATE_MAP
): { rules: string[]; insertIndex: number; inserted: boolean } {
  const nextRule = ruleToString(RULE_TEMPLATE_MAP[template])
  if (template === 'MATCH') {
    if (hasMatchRule(rules)) return { rules, insertIndex: rules.length - 1, inserted: false }
    return { rules: [...rules, nextRule], insertIndex: rules.length, inserted: true }
  }
  return { rules: [nextRule, ...rules], insertIndex: 0, inserted: true }
}

export function normalizeMatchRuleOrder(rules: string[]): string[] {
  const matchRules = rules.filter((rule) => parseRule(rule).type === 'MATCH')
  const otherRules = rules.filter((rule) => parseRule(rule).type !== 'MATCH')
  return [...otherRules, ...matchRules]
}

export interface RuleAnalysisContext {
  availableTargets: Set<string>
  availableRuleProviders: Set<string>
  selectedRuleProviders: Set<string>
  duplicateCount: number
  isLastRule: boolean
}

export function buildRuleAnalysis(rule: string, ctx: RuleAnalysisContext): RuleAnalysis {
  const parsed = parseRule(rule)
  const type = normalizeRuleType(parsed.type)
  const payload = parsed.payload.trim()
  const target = parsed.target.trim()
  const errors: string[] = []
  const warnings: string[] = []
  const quickFixes: RuleQuickFix[] = []

  if (!rule.trim()) {
    errors.push('空规则不会被保存')
  }
  if (!type) {
    errors.push('缺少规则类型')
  } else if (!RULE_TYPES.includes(type as (typeof RULE_TYPES)[number])) {
    errors.push(`不支持的规则类型：${type}`)
  }
  if (type !== 'MATCH' && !payload) {
    errors.push('缺少匹配内容')
  }
  if (!target) {
    errors.push(type === 'MATCH' ? 'MATCH 规则必须指定目标策略' : '缺少目标策略')
  }
  if (type === 'RULE-SET' && payload) {
    if (!ctx.availableRuleProviders.has(payload)) {
      errors.push(`规则集 "${payload}" 不存在`)
      quickFixes.push({ type: 'go-rule-sets', label: '检查规则集引用' })
    } else if (!ctx.selectedRuleProviders.has(payload)) {
      warnings.push(`规则集 "${payload}" 尚未在“规则集引用”中勾选`)
      quickFixes.push({ type: 'go-rule-sets', label: '前往勾选规则集' })
    }
  }
  if (target && !ctx.availableTargets.has(target)) {
    warnings.push(`目标策略 "${target}" 当前不存在于内置策略、代理组或节点中`)
    quickFixes.push({ type: 'go-target-groups', label: '检查代理组' })
    quickFixes.push({ type: 'go-target-proxies', label: '检查代理节点' })
  }
  if (type === 'MATCH' && target && !ctx.isLastRule) {
    warnings.push('MATCH 建议保持在规则列表最后')
    quickFixes.push({ type: 'move-match-to-bottom', label: '移到底部' })
  }
  if (parsed.noResolve && !ruleSupportsNoResolve(type)) {
    warnings.push('no-resolve 通常仅用于 GEOIP / IP-CIDR 等目标 IP 类规则，当前类型可能不会按预期生效')
  }
  if (ctx.duplicateCount > 1) {
    warnings.push(`存在 ${ctx.duplicateCount} 条完全相同的规则`)
  }

  const status = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'valid'
  return { rule, parsed, status, errors, warnings, quickFixes }
}
