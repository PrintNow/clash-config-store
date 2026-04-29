export interface ParsedRule {
  type: string
  payload: string
  target: string
  /** 末尾附加 `,no-resolve`（目标 IP 类与 RULE-SET 等类型可由 Mihomo 支持） */
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
  errors: RuleAnalysisMessage[]
  warnings: RuleAnalysisMessage[]
  quickFixes: RuleQuickFix[]
}

export interface RuleAnalysisMessage {
  key: string
  params?: Record<string, string | number>
}

export type RuleQuickFixAction =
  | 'move-match-to-bottom'
  | 'go-rule-sets'
  | 'go-target-groups'
  | 'go-target-proxies'

export interface RuleQuickFix {
  type: RuleQuickFixAction
  labelKey: string
  labelParams?: Record<string, string | number>
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

/** Mihomo：目标 IP 类规则在域名场景下会触发解析，no-resolve 可跳过；RULE-SET 亦支持该附加参数 */
export const NO_RESOLVE_RULE_TYPES = new Set<string>([
  'GEOIP',
  'IP-CIDR',
  'IP-CIDR6',
  'IP-SUFFIX',
  'IP-ASN',
  'RULE-SET',
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
  // Mihomo: FINAL 是 MATCH 的别名（原 Clash 规范）
  const resolvedType = type === 'FINAL' ? 'MATCH' : type
  if (resolvedType === 'MATCH') {
    return { type: 'MATCH', payload: '', target: parts[1] || '', noResolve: false }
  }
  if (COMMA_PAYLOAD_RULE_TYPES.has(resolvedType)) {
    return {
      type: resolvedType,
      payload: parts.slice(1, -1).join(','),
      target: parts.at(-1) || '',
      noResolve,
    }
  }
  return { type: resolvedType, payload: parts[1] || '', target: parts[2] || '', noResolve }
}

export function ruleToString(r: ParsedRule): string {
  const rawType = r.type.trim().toUpperCase()
  // Mihomo: FINAL 是 MATCH 的别名，统一输出 MATCH
  const type = rawType === 'FINAL' ? 'MATCH' : rawType
  const nr = r.noResolve ? ',no-resolve' : ''
  if (type === 'MATCH') return `MATCH,${r.target.trim()}`
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
  const type = parsed.type
  const payload = parsed.payload.trim()
  const target = parsed.target.trim()
  const errors: RuleAnalysisMessage[] = []
  const warnings: RuleAnalysisMessage[] = []
  const quickFixes: RuleQuickFix[] = []

  if (!rule.trim()) {
    errors.push({ key: 'customConfigs.ruleAnalysis.emptyRule' })
  }
  if (!type) {
    errors.push({ key: 'customConfigs.ruleAnalysis.missingType' })
  } else if (!RULE_TYPES.includes(type as (typeof RULE_TYPES)[number])) {
    errors.push({ key: 'customConfigs.ruleAnalysis.unsupportedType', params: { type } })
  }
  if (type !== 'MATCH' && !payload) {
    errors.push({ key: 'customConfigs.ruleAnalysis.missingPayload' })
  }
  if (!target) {
    errors.push({
      key: type === 'MATCH'
        ? 'customConfigs.ruleAnalysis.matchMissingTarget'
        : 'customConfigs.ruleAnalysis.missingTarget',
    })
  }
  if (type === 'RULE-SET' && payload) {
    if (!ctx.availableRuleProviders.has(payload)) {
      errors.push({ key: 'customConfigs.ruleAnalysis.ruleSetNotFound', params: { name: payload } })
      quickFixes.push({ type: 'go-rule-sets', labelKey: 'customConfigs.ruleAnalysis.fixCheckRuleSets' })
    } else if (!ctx.selectedRuleProviders.has(payload)) {
      warnings.push({ key: 'customConfigs.ruleAnalysis.ruleSetNotSelected', params: { name: payload } })
      quickFixes.push({ type: 'go-rule-sets', labelKey: 'customConfigs.ruleAnalysis.fixGoSelectRuleSets' })
    }
  }
  if (target && !ctx.availableTargets.has(target)) {
    warnings.push({ key: 'customConfigs.ruleAnalysis.targetNotFound', params: { name: target } })
    quickFixes.push({ type: 'go-target-groups', labelKey: 'customConfigs.ruleAnalysis.fixCheckGroups' })
    quickFixes.push({ type: 'go-target-proxies', labelKey: 'customConfigs.ruleAnalysis.fixCheckProxies' })
  }
  if (type === 'MATCH' && target && !ctx.isLastRule) {
    warnings.push({ key: 'customConfigs.ruleAnalysis.matchShouldBeLast' })
    quickFixes.push({ type: 'move-match-to-bottom', labelKey: 'customConfigs.ruleAnalysis.fixMoveToBottom' })
  }
  if (parsed.noResolve && !ruleSupportsNoResolve(type)) {
    warnings.push({ key: 'customConfigs.ruleAnalysis.noResolveUnsupported' })
  }
  if (ctx.duplicateCount > 1) {
    warnings.push({ key: 'customConfigs.ruleAnalysis.duplicateRules', params: { count: ctx.duplicateCount } })
  }

  const status = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'valid'
  return { rule, parsed, status, errors, warnings, quickFixes }
}
