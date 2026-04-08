import type { ProxyGroup, ProxyNode } from '@/types'

/** 与 CustomConfigDetail 表格规则解析一致 */
function parseRule(rule: string): { type: string; payload: string; target: string } {
  const parts = rule.split(',').map((s) => s.trim())
  if (parts[0] === 'MATCH') {
    return { type: 'MATCH', payload: '', target: parts[1] || '' }
  }
  return { type: parts[0] || '', payload: parts[1] || '', target: parts[2] || '' }
}

function ruleToString(r: { type: string; payload: string; target: string }): string {
  if (r.type === 'MATCH') return `MATCH,${r.target}`
  return `${r.type},${r.payload},${r.target}`
}

/** 若策略列与 oldName 全等则替换为 newName，否则原样返回 */
function replaceRulePolicyIfMatch(
  ruleLine: string,
  oldName: string,
  newName: string
): { next: string; changed: number } {
  const trimmed = ruleLine.trim()
  if (!trimmed) return { next: ruleLine, changed: 0 }
  const parsed = parseRule(trimmed)
  if (parsed.target !== oldName) return { next: ruleLine, changed: 0 }
  const nextCore = ruleToString({ ...parsed, target: newName })
  // 保留行首缩进等前缀空白
  const prefixLen = ruleLine.length - ruleLine.trimStart().length
  const prefix = ruleLine.slice(0, prefixLen)
  return { next: prefix + nextCore, changed: 1 }
}

function replaceProxiesMember(
  proxies: string[] | undefined,
  oldName: string,
  newName: string
): { next: string[] | undefined; changed: number } {
  if (!proxies?.length) return { next: proxies, changed: 0 }
  let changed = 0
  const next = proxies.map((p) => {
    if (p === oldName) {
      changed++
      return newName
    }
    return p
  })
  return { next, changed }
}

export interface RenameRefsInput {
  proxyGroups: ProxyGroup[]
  rules: string[]
  rulesText: string
  rulesTextMode: boolean
}

export interface RenameRefsResult {
  proxyGroups: ProxyGroup[]
  rules: string[]
  rulesText: string
  replaceCount: number
}

/**
 * 将旧名替换为新名：所有代理组的 proxies 成员（全等匹配）、以及规则中的策略列。
 * 不处理 use（provider 名），避免误替换。
 */
export function renameProxyOrGroupRefs(
  oldName: string,
  newName: string,
  input: RenameRefsInput
): RenameRefsResult {
  const trimmedOld = oldName.trim()
  const trimmedNew = newName.trim()
  if (!trimmedOld || trimmedOld === trimmedNew) {
    return {
      proxyGroups: input.proxyGroups,
      rules: input.rules,
      rulesText: input.rulesText,
      replaceCount: 0,
    }
  }

  let replaceCount = 0

  const proxyGroups = input.proxyGroups.map((g) => {
    const { next, changed } = replaceProxiesMember(g.proxies, trimmedOld, trimmedNew)
    replaceCount += changed
    if (next === g.proxies) return g
    return { ...g, proxies: next }
  })

  let rules = input.rules
  let rulesText = input.rulesText

  if (input.rulesTextMode) {
    const lines = input.rulesText.split('\n')
    const newLines = lines.map((line) => {
      const { next, changed } = replaceRulePolicyIfMatch(line, trimmedOld, trimmedNew)
      replaceCount += changed
      return next
    })
    rulesText = newLines.join('\n')
    rules = rulesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  } else {
    rules = input.rules.map((r) => {
      const { next, changed } = replaceRulePolicyIfMatch(r, trimmedOld, trimmedNew)
      replaceCount += changed
      return next
    })
  }

  return { proxyGroups, rules, rulesText, replaceCount }
}

export type RenameConflictExclude =
  | { kind: 'proxy'; index: number }
  | { kind: 'group'; index: number }

/** 新名是否与已有代理/组名冲突（可排除当前正在编辑的一项） */
export function hasProxyOrGroupNameConflict(
  newName: string,
  proxies: ProxyNode[],
  proxyGroups: ProxyGroup[],
  exclude?: RenameConflictExclude
): boolean {
  const n = newName.trim()
  if (!n) return false

  for (let i = 0; i < proxies.length; i++) {
    if (exclude?.kind === 'proxy' && exclude.index === i) continue
    if (proxies[i].name.trim() === n) return true
  }
  for (let i = 0; i < proxyGroups.length; i++) {
    if (exclude?.kind === 'group' && exclude.index === i) continue
    if (proxyGroups[i].name.trim() === n) return true
  }
  return false
}
