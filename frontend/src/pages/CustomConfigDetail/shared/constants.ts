import { parseRulesTextFull } from '@/domain/rules'
import type { RuleAnalysis } from '@/domain/rules'
import type { CustomConfig } from '@/types'

// ─────────────────────────────────────────────
// dnd-kit 表格排序
// ─────────────────────────────────────────────

/** dnd-kit 纵向排序：tbody 为 block、tr 为 table 时行上 transform 才能正确挤位 */
export const SORTABLE_TABLE_LAYOUT =
  'w-full text-sm [&_thead_tr]:table [&_thead_tr]:w-full [&_thead_tr]:table-fixed [&_tbody]:block [&_tbody_tr]:table [&_tbody_tr]:w-full [&_tbody_tr]:table-fixed'

/** 关闭 transform 过渡与布局动画，避免松手后动画与 React 重排冲突出现回弹 */
export const sortableInstantReorder = {
  transition: null,
  animateLayoutChanges: () => false,
} as const

// ─────────────────────────────────────────────
// 规则草稿工具函数
// ─────────────────────────────────────────────

/**
 * 返回混合格式的规则数组（含 # 注释行）用于持久化。
 * 表格模式：直接返回已序列化的 mixedRules。
 * 原文模式：从 rulesText 重新解析，保留注释行。
 */
export function rulesFromDraft(
  rulesTextMode: boolean,
  rulesText: string,
  mixedRules: string[]
): string[] {
  return rulesTextMode
    ? parseRulesTextFull(rulesText).mixed
    : mixedRules
}

/** 规则列表 arrayMove 后，将当前展开行的下标映射到新数组索引 */
export function remapRuleIndexAfterMove(
  active: number | null,
  oldIdx: number,
  newIdx: number
): number | null {
  if (active === null) return null
  if (active === oldIdx) return newIdx
  if (oldIdx < newIdx) {
    if (active > oldIdx && active <= newIdx) return active - 1
  } else if (oldIdx > newIdx) {
    if (active >= newIdx && active < oldIdx) return active + 1
  }
  return active
}

// ─────────────────────────────────────────────
// 配置 payload 类型
// ─────────────────────────────────────────────

/** 用于脏检查与提交的 payload 形状 */
export type CustomConfigDraftPayload = Pick<
  CustomConfig,
  'name' | 'proxy_groups' | 'rules' | 'rule_provider_ids' | 'hosted_rule_set_ids'
>

export function savedPayloadFromConfig(c: CustomConfig): CustomConfigDraftPayload {
  return {
    name: c.name,
    proxy_groups: c.proxy_groups || [],
    rules: c.rules || [],
    rule_provider_ids: c.rule_provider_ids || [],
    hosted_rule_set_ids: c.hosted_rule_set_ids || [],
  }
}

// ─────────────────────────────────────────────
// 规则集引用
// ─────────────────────────────────────────────

export type RuleSetReferenceItem = {
  id: number
  name: string
  behavior: string
  url?: string
  source: 'preset' | 'external' | 'hosted'
}

// ─────────────────────────────────────────────
// 规则列表项 / 选项 / 过滤
// ─────────────────────────────────────────────

export interface RuleListItem {
  sourceIndex: number
  lineNumber?: number
  /** 规则上方的行注释文本（不含 # 前缀），无注释时为 undefined */
  comment?: string
  analysis: RuleAnalysis
}

export interface RuleTargetOptionGroup {
  key: string
  label: string
  values: string[]
}

export type RuleFilterValue = 'all' | 'domain' | 'rule-set' | 'geoip' | 'match'

export const RULE_FILTER_OPTIONS: Array<{ value: RuleFilterValue; labelKey: string }> = [
  { value: 'all', labelKey: 'customConfigs.ruleFilterAll' },
  { value: 'domain', labelKey: 'customConfigs.ruleFilterDomain' },
  { value: 'rule-set', labelKey: 'customConfigs.ruleFilterRuleSet' },
  { value: 'geoip', labelKey: 'customConfigs.ruleFilterGeoIp' },
  { value: 'match', labelKey: 'customConfigs.ruleFilterMatch' },
]

// ─────────────────────────────────────────────
// 内置代理
// ─────────────────────────────────────────────

export const BUILTIN_PROXIES = ['DIRECT', 'REJECT']

// ─────────────────────────────────────────────
// Tab 路由同步
// ─────────────────────────────────────────────

// 自定义配置详情页 Tab，与 URL ?tab= 同步以便刷新保留
export const CONFIG_DETAIL_TABS = ['proxyGroups', 'rules', 'ruleSets', 'yamlEdit', 'history'] as const
export type ConfigDetailTab = (typeof CONFIG_DETAIL_TABS)[number]

export function parseConfigDetailTab(raw: string | null): ConfigDetailTab {
  if (raw && (CONFIG_DETAIL_TABS as readonly string[]).includes(raw)) {
    return raw as ConfigDetailTab
  }
  return 'proxyGroups'
}
