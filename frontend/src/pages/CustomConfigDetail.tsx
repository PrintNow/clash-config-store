import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams, useBlocker } from 'react-router-dom'
import type { Blocker } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit,
  Eye,
  Pencil,
  Check,
  X,
  GripVertical,
  Search,
  CircleAlert,
  CircleCheck,
  FileText,
  ListFilter,
  ArrowDownUp,
  Copy,
  RefreshCw,
  PanelRightOpen,
} from 'lucide-react'
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import equal from 'fast-deep-equal'
import { customConfigsApi } from '@/api/custom-configs'
import { ruleProvidersApi } from '@/api/rule-providers'
import { hostedRuleSetsApi } from '@/api/hosted-rule-sets'
import { providersApi } from '@/api/providers'
import type { CustomConfig, ProxyNode, ProxyGroup } from '@/types'
import { ProxyPasswordInput } from '@/components/ProxyPasswordInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { YamlEditor } from '@/components/YamlEditor'
import { ConfigPayloadDiffDialog } from '@/components/ConfigPayloadDiffDialog'
import { cn } from '@/lib/utils'
import { useRegisterContextSaveBar } from '@/store/context-save-bar'
import { hasProxyOrGroupNameConflict, renameProxyOrGroupRefs } from '@/lib/rename-refs'
import {
  buildRuleAnalysis,
  canUseMatchType,
  hasMatchRule as hasMatchRuleInList,
  insertRule,
  parseRule,
  ParsedRule,
  parseRulesText,
  RuleQuickFixAction,
  RULE_TEMPLATE_MAP,
  RULE_TYPES,
  ruleToString,
} from '@/domain/rules'

// ─────────────────────────────────────────────
// 工具函数：简单对象 <-> YAML 字符串互转
// ─────────────────────────────────────────────

/** 将代理节点对象序列化为简单 YAML 字符串 */
function proxyToYaml(proxy: Record<string, unknown>): string {
  const lines: string[] = []
  for (const [key, val] of Object.entries(proxy)) {
    if (key === '__raw__') continue
    if (val === undefined || val === null) continue
    if (typeof val === 'boolean') {
      lines.push(`${key}: ${val}`)
    } else if (typeof val === 'number') {
      lines.push(`${key}: ${val}`)
    } else if (typeof val === 'string') {
      if (val === '') continue
      // 含特殊字符时加引号
      if (/[:#{}[\]|>&*!,?]/.test(val) || val.includes('\n')) {
        lines.push(`${key}: "${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
      } else {
        lines.push(`${key}: ${val}`)
      }
    } else if (Array.isArray(val)) {
      if (val.length === 0) {
        lines.push(`${key}: []`)
      } else {
        lines.push(`${key}:`)
        for (const item of val) {
          lines.push(`  - ${item}`)
        }
      }
    } else if (typeof val === 'object') {
      lines.push(`${key}: ${JSON.stringify(val)}`)
    }
  }
  return lines.join('\n')
}

/** 与 proxyToYaml 一致的标量引号规则，用于补丁替换 YAML 中的 name 行 */
function yamlScalarForProxyName(val: string): string {
  if (/[:#{}[\]|>&*!,?]/.test(val) || val.includes('\n')) {
    return `"${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  return val
}

/** 自定义节点：替换首处 name 行（支持 `- name:` / `name:`） */
function replaceProxyYamlNameLine(rawYaml: string, newName: string): string {
  return rawYaml.replace(/^(\s*(?:-\s+)?name:\s*)(.+)$/m, (_, p1: string) => `${p1}${yamlScalarForProxyName(newName)}`)
}

/** 将简单 YAML 字符串解析为对象（仅支持扁平结构和一级数组） */
function yamlToProxy(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  const lines = yaml.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) { i++; continue }

    // 数组字段：下一行开始以 "- " 为前缀
    const arrKeyMatch = trimmed.match(/^([\w][\w-]*)\s*:\s*$/)
    if (arrKeyMatch && i + 1 < lines.length && lines[i + 1].trim().startsWith('- ')) {
      const key = arrKeyMatch[1]
      const items: string[] = []
      i++
      while (i < lines.length && lines[i].trim().startsWith('- ')) {
        items.push(lines[i].trim().slice(2).trim())
        i++
      }
      result[key] = items
      continue
    }

    const kvMatch = trimmed.match(/^([\w][\w-]*)\s*:\s*(.*)$/)
    if (kvMatch) {
      const key = kvMatch[1]
      let raw = kvMatch[2].trim()
      if (raw === '' || raw === 'null') { result[key] = ''; i++; continue }
      if (raw === 'true') { result[key] = true; i++; continue }
      if (raw === 'false') { result[key] = false; i++; continue }
      if (raw === '[]') { result[key] = []; i++; continue }
      const num = Number(raw)
      if (!isNaN(num) && raw !== '') { result[key] = num; i++; continue }
      // 去掉首尾引号
      if (
        (raw.startsWith('"') && raw.endsWith('"')) ||
        (raw.startsWith("'") && raw.endsWith("'"))
      ) {
        raw = raw.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
      }
      result[key] = raw
    }
    i++
  }
  return result
}

// ─────────────────────────────────────────────
// 规则解析工具
// ─────────────────────────────────────────────

interface RuleAnalysis {
  rule: string
  parsed: ParsedRule
  status: 'valid' | 'warning' | 'error'
  errors: string[]
  warnings: string[]
  quickFixes: Array<{ type: RuleQuickFixAction; label: string }>
}

interface RuleListItem {
  sourceIndex: number
  lineNumber?: number
  analysis: RuleAnalysis
}

interface RuleTargetOptionGroup {
  key: string
  label: string
  values: string[]
}

interface RuleTypeMeta {
  payloadLabel: string
  payloadPlaceholder: string
  hint: string
  category: RuleFilterValue
}

type RuleFilterValue = 'all' | 'domain' | 'rule-set' | 'geoip' | 'match'

const RULE_FILTER_OPTIONS: Array<{ value: RuleFilterValue; labelKey: string }> = [
  { value: 'all', labelKey: 'customConfigs.ruleFilterAll' },
  { value: 'domain', labelKey: 'customConfigs.ruleFilterDomain' },
  { value: 'rule-set', labelKey: 'customConfigs.ruleFilterRuleSet' },
  { value: 'geoip', labelKey: 'customConfigs.ruleFilterGeoIp' },
  { value: 'match', labelKey: 'customConfigs.ruleFilterMatch' },
]

const RULE_TYPE_META: Record<string, RuleTypeMeta> = {
  DOMAIN: {
    payloadLabel: 'Domain',
    payloadPlaceholder: 'github.com',
    hint: '精确域名匹配',
    category: 'domain',
  },
  'DOMAIN-SUFFIX': {
    payloadLabel: 'Suffix',
    payloadPlaceholder: 'github.com',
    hint: '匹配域名后缀',
    category: 'domain',
  },
  'DOMAIN-KEYWORD': {
    payloadLabel: 'Keyword',
    payloadPlaceholder: 'github',
    hint: '匹配域名关键字',
    category: 'domain',
  },
  'DOMAIN-REGEX': {
    payloadLabel: 'Regex',
    payloadPlaceholder: '^.*github.*$',
    hint: '支持逗号，使用正则表达式',
    category: 'domain',
  },
  'DOMAIN-WILDCARD': {
    payloadLabel: 'Wildcard',
    payloadPlaceholder: '*.github.com',
    hint: '匹配通配符域名',
    category: 'domain',
  },
  GEOSITE: {
    payloadLabel: 'GeoSite',
    payloadPlaceholder: 'github',
    hint: 'GeoSite 分类名称',
    category: 'domain',
  },
  GEOIP: {
    payloadLabel: 'Country Code',
    payloadPlaceholder: 'CN',
    hint: '国家/地区代码',
    category: 'geoip',
  },
  'SRC-GEOIP': {
    payloadLabel: 'Country Code',
    payloadPlaceholder: 'CN',
    hint: '源地址国家/地区代码',
    category: 'geoip',
  },
  'IP-CIDR': {
    payloadLabel: 'CIDR',
    payloadPlaceholder: '1.1.1.0/24',
    hint: 'IPv4 CIDR',
    category: 'all',
  },
  'IP-CIDR6': {
    payloadLabel: 'CIDR6',
    payloadPlaceholder: '240c::/32',
    hint: 'IPv6 CIDR',
    category: 'all',
  },
  'RULE-SET': {
    payloadLabel: 'Rule Set',
    payloadPlaceholder: 'apple',
    hint: '引用规则集库中的名称',
    category: 'rule-set',
  },
  'PROCESS-NAME': {
    payloadLabel: 'Process',
    payloadPlaceholder: 'Telegram',
    hint: '进程名匹配',
    category: 'all',
  },
  MATCH: {
    payloadLabel: '',
    payloadPlaceholder: '',
    hint: '兜底规则，通常应放在最后',
    category: 'match',
  },
}

function getRuleTypeMeta(type: string): RuleTypeMeta {
  return RULE_TYPE_META[type.trim().toUpperCase()] ?? {
    payloadLabel: 'Payload',
    payloadPlaceholder: 'rule payload',
    hint: '当前规则类型未提供专用提示',
    category: 'all',
  }
}

function getRuleStatusTone(status: RuleAnalysis['status']) {
  if (status === 'error') return 'text-destructive border-destructive/40 bg-destructive/5'
  if (status === 'warning') return 'text-amber-700 border-amber-500/40 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10'
  return 'text-emerald-700 border-emerald-500/30 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/10'
}

function getRuleStatusLabel(status: RuleAnalysis['status'], t: (key: string) => string) {
  if (status === 'error') return t('customConfigs.ruleStatusError')
  if (status === 'warning') return t('customConfigs.ruleStatusWarning')
  return t('customConfigs.ruleStatusValid')
}

function buildRuleSaveChecklist(
  finalRules: string[],
  currentRuleStrings: string[],
  ruleListItems: RuleListItem[]
): 'valid' | 'warning' | 'error' {
  if (ruleListItems.some((item) => item.analysis.status === 'error')) {
    return 'error'
  }
  const matchIndex = finalRules.findIndex((rule) => parseRule(rule).type === 'MATCH')
  if (matchIndex >= 0 && matchIndex !== finalRules.length - 1) {
    return 'warning'
  }
  if (
    ruleListItems.some((item) => item.analysis.status === 'warning')
    || currentRuleStrings.length !== finalRules.length
  ) {
    return 'warning'
  }
  return 'valid'
}

// ─────────────────────────────────────────────
// 可拖拽规则行组件
// ─────────────────────────────────────────────

interface SortableRuleRowProps {
  id: string
  item: RuleListItem
  allRuleSets: RuleSetReferenceItem[]
  targetOptionGroups: RuleTargetOptionGroup[]
  onUpdate: (sourceIndex: number, field: keyof ParsedRule, value: string) => void
  onDelete: (sourceIndex: number) => void
  isActive: boolean
  onFocus: (sourceIndex: number) => void
  onQuickFix: (sourceIndex: number, action: RuleQuickFixAction) => void
  t: (key: string) => string
}

function SortableRuleRow({
  id, item, allRuleSets, targetOptionGroups, onUpdate, onDelete, isActive, onFocus, onQuickFix, t,
}: SortableRuleRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, ...sortableInstantReorder })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const { analysis, sourceIndex, lineNumber } = item
  const parsed = analysis.parsed
  const meta = getRuleTypeMeta(parsed.type)
  const ruleProviderExists = allRuleSets.some((rp) => rp.name === parsed.payload)
  const targetOptions = targetOptionGroups.flatMap((group) => group.values)
  const targetExists = parsed.target === '' || targetOptions.includes(parsed.target)
  const currentRuleProvider = parsed.payload && !ruleProviderExists ? parsed.payload : null
  const currentTarget = parsed.target && !targetExists ? parsed.target : null
  const showHelp = isActive && analysis.errors.length === 0 && analysis.warnings.length === 0
  const helpMessage =
    parsed.type === 'MATCH'
      ? t('customConfigs.matchRuleHint')
      : parsed.type === 'RULE-SET'
        ? t('customConfigs.ruleSetSelectionHint')
        : `${meta.hint} · ${t('customConfigs.ruleTargetHint')}`

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group cursor-pointer rounded-xl border bg-background transition-colors',
        analysis.status === 'valid' && 'border-border/70',
        isActive &&
          'border-primary/40 bg-primary/[0.09] shadow-sm dark:border-primary/35 dark:bg-primary/[0.14]',
        analysis.status === 'error' && 'border-destructive/40',
        analysis.status === 'warning' && 'border-amber-500/40',
        isDragging && 'relative z-10 shadow-md'
      )}
      onClick={() => onFocus(sourceIndex)}
    >
      <div className="flex items-center gap-3 border-b border-border/60 px-3 py-3">
        <div className="flex items-center gap-2 self-stretch">
          <button
            type="button"
            className={cn(
              'flex h-9 w-8 items-center justify-center rounded text-muted-foreground transition-opacity hover:text-foreground cursor-grab active:cursor-grabbing',
              isActive ? 'opacity-100' : 'opacity-30 group-hover:opacity-100'
            )}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              {lineNumber ? `L${lineNumber}` : `#${sourceIndex + 1}`}
            </span>
            <Badge variant="outline">{parsed.type || 'UNKNOWN'}</Badge>
            <Badge variant="outline" className={cn('border', getRuleStatusTone(analysis.status))}>
              {getRuleStatusLabel(analysis.status, t)}
            </Badge>
            {!isActive && parsed.payload && (
              <span className="max-w-[240px] truncate rounded-full bg-muted px-2 py-1 text-xs font-mono text-muted-foreground">
                {parsed.payload}
              </span>
            )}
            {!isActive && parsed.target && (
              <span className="max-w-[220px] truncate rounded-full bg-muted px-2 py-1 text-xs font-medium text-foreground/80">
                {parsed.target}
              </span>
            )}
          </div>
          </div>
          <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(sourceIndex)
          }}
          >
          <Trash2 className="h-3.5 w-3.5" />
          </Button>
          </div>

          {isActive && (
          <div className="space-y-3 px-3 py-3">
          <div className="grid gap-3 lg:grid-cols-[160px_minmax(220px,1fr)_minmax(220px,1fr)] lg:items-start">

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t('customConfigs.ruleType')}</Label>
              <Select value={parsed.type} onValueChange={(v) => onUpdate(sourceIndex, 'type', v)}>
                <SelectTrigger className="h-9 text-sm" onFocus={() => onFocus(sourceIndex)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {!RULE_TYPES.includes(parsed.type as (typeof RULE_TYPES)[number]) && parsed.type && (
                    <>
                      <SelectItem value={parsed.type}>{parsed.type}</SelectItem>
                      <SelectSeparator />
                    </>
                  )}
                  {RULE_TYPES.map((rt) => (
                    <SelectItem key={rt} value={rt}>{rt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {parsed.type === 'MATCH'
                  ? t('customConfigs.rulePayloadNotRequired')
                  : meta.payloadLabel || t('customConfigs.rulePayload')}
              </Label>
              {parsed.type === 'MATCH' ? (
                <div className="flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm text-muted-foreground">
                  {t('customConfigs.matchRuleCompactHint')}
                </div>
              ) : parsed.type === 'RULE-SET' ? (
                <Select
                  value={parsed.payload}
                  onValueChange={(v) => onUpdate(sourceIndex, 'payload', v)}
                >
                  <SelectTrigger
                    className={cn(
                      'h-9 text-sm',
                      !ruleProviderExists && parsed.payload && 'border-destructive text-destructive',
                      ruleProviderExists && analysis.warnings.some((message) => message.includes('尚未')) && 'border-amber-500'
                    )}
                    onFocus={() => onFocus(sourceIndex)}
                  >
                    <SelectValue placeholder={t('customConfigs.selectRuleSets')} />
                  </SelectTrigger>
                  <SelectContent>
                    {currentRuleProvider && (
                      <>
                        <SelectItem value={currentRuleProvider}>{currentRuleProvider}</SelectItem>
                        <SelectSeparator />
                      </>
                    )}
                    {allRuleSets.some((rp) => rp.source === 'preset') && (
                      <SelectGroup>
                        <SelectLabel>{t('ruleProviders.loyalsoldierSection')}</SelectLabel>
                        {allRuleSets.filter((rp) => rp.source === 'preset').map((rp) => (
                          <SelectItem key={rp.id} value={rp.name}>{rp.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    {allRuleSets.some((rp) => rp.source === 'external') && (
                      <SelectGroup>
                        <SelectLabel>{t('ruleProviders.customSection')}</SelectLabel>
                        {allRuleSets.filter((rp) => rp.source === 'external').map((rp) => (
                          <SelectItem key={rp.id} value={rp.name}>{rp.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                    {allRuleSets.some((rp) => rp.source === 'hosted') && (
                      <SelectGroup>
                        <SelectLabel>{t('hostedRuleSets.customSection')}</SelectLabel>
                        {allRuleSets.filter((rp) => rp.source === 'hosted').map((rp) => (
                          <SelectItem key={`hosted-${rp.id}`} value={rp.name}>{rp.name}</SelectItem>
                        ))}
                      </SelectGroup>
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="h-9 text-sm font-mono"
                  value={parsed.payload}
                  onFocus={() => onFocus(sourceIndex)}
                  onChange={(e) => onUpdate(sourceIndex, 'payload', e.target.value)}
                  placeholder={meta.payloadPlaceholder}
                />
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t('customConfigs.ruleTarget')}</Label>
              <Select value={parsed.target} onValueChange={(v) => onUpdate(sourceIndex, 'target', v)}>
                <SelectTrigger
                  className={cn(
                    'h-9 text-sm',
                    !targetExists && parsed.target && 'border-destructive text-destructive'
                  )}
                  onFocus={() => onFocus(sourceIndex)}
                >
                  <SelectValue placeholder="DIRECT / PROXY" />
                </SelectTrigger>
                <SelectContent viewportClassName="p-0.5">
                  {currentTarget && (
                    <>
                      <SelectItem
                        value={currentTarget}
                        className="py-1 pl-9 pr-1.5"
                      >
                        {currentTarget}
                      </SelectItem>
                      <SelectSeparator />
                    </>
                  )}
                  {targetOptionGroups.map((group) => (
                    group.values.length > 0 && (
                      <SelectGroup key={group.key}>
                        <SelectLabel className="py-0.5 pl-2 pr-2 text-sm font-semibold text-muted-foreground">
                          {group.label}
                        </SelectLabel>
                        {group.values.map((value) => (
                          <SelectItem
                            key={`${group.key}-${value}`}
                            value={value}
                            className="py-1 pl-9 pr-1.5"
                          >
                            {value}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {parsed.type === 'MATCH' && analysis.warnings.some((message) => message.includes('MATCH')) && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{t('customConfigs.matchShouldBeLast')}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-amber-500/40 bg-background"
                  onClick={(e) => {
                    e.stopPropagation()
                    onQuickFix(sourceIndex, 'move-match-to-bottom')
                  }}
                >
                  {t('customConfigs.normalizeMatch')}
                </Button>
              </div>
            </div>
          )}

          {(analysis.errors.length > 0 || analysis.warnings.length > 0 || showHelp) && (
            <div className="rounded-lg bg-muted/20 px-3 py-2 text-xs">
              <div className="space-y-1">
                {analysis.errors.map((message) => (
                  <p key={`e-${message}`} className="text-destructive">{message}</p>
                ))}
                {analysis.warnings.map((message) => (
                  <p
                    key={`w-${message}`}
                    className="text-amber-700 dark:text-amber-300"
                  >
                    {message}
                  </p>
                ))}
                {showHelp && analysis.errors.length === 0 && analysis.warnings.length === 0 && (
                  <p className="text-muted-foreground">{helpMessage}</p>
                )}
              </div>
              {analysis.quickFixes.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {analysis.quickFixes.map((fix) => (
                    <Button
                      key={`${sourceIndex}-${fix.type}`}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation()
                        onQuickFix(sourceIndex, fix.type)
                      }}
                    >
                      {fix.label}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// 可拖拽代理组行
// ─────────────────────────────────────────────

interface SortableProxyGroupRowProps {
  id: string
  group: ProxyGroup
  idx: number
  onEdit: (group: ProxyGroup, idx: number) => void
  onDelete: (idx: number) => void
}

function SortableProxyGroupRow({
  id, group, idx, onEdit, onDelete,
}: SortableProxyGroupRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, ...sortableInstantReorder })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn(
        'border-t hover:bg-muted/30 cursor-pointer',
        isDragging && 'relative z-10'
      )}
      onClick={() => onEdit(group, idx)}
    >
      <td className="px-1 py-2 w-[28px]" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 rounded"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </td>
      <td className="px-4 py-2 font-medium">{group.name}</td>
      <td className="px-4 py-2">
        <Badge variant="outline">{group.type}</Badge>
      </td>
      <td className="px-4 py-2 text-muted-foreground text-xs">
        {(group.proxies || []).slice(0, 3).join(', ')}
        {(group.proxies || []).length > 3 && ` +${(group.proxies || []).length - 3}`}
      </td>
      <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onEdit(group, idx)}
          >
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(idx)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  )
}

/** dnd-kit 纵向排序：tbody 为 block、tr 为 table 时行上 transform 才能正确挤位 */
const SORTABLE_TABLE_LAYOUT =
  'w-full text-sm [&_thead_tr]:table [&_thead_tr]:w-full [&_thead_tr]:table-fixed [&_tbody]:block [&_tbody_tr]:table [&_tbody_tr]:w-full [&_tbody_tr]:table-fixed'

/** 关闭 transform 过渡与布局动画，避免松手后动画与 React 重排冲突出现回弹 */
const sortableInstantReorder = {
  transition: null,
  animateLayoutChanges: () => false,
} as const

/** 与保存 API 一致的规则草稿（表格模式用 rules，原文模式解析 rulesText） */
function rulesFromDraft(
  rulesTextMode: boolean,
  rulesText: string,
  rules: string[]
): string[] {
  return rulesTextMode
    ? parseRulesText(rulesText).rules
    : rules
}

/** 规则列表 arrayMove 后，将当前展开行的下标映射到新数组索引 */
function remapRuleIndexAfterMove(
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

/** 用于脏检查与提交的 payload 形状 */
type CustomConfigDraftPayload = Pick<
  CustomConfig,
  'name' | 'proxies' | 'proxy_groups' | 'rules' | 'rule_provider_ids' | 'hosted_rule_set_ids'
>

function savedPayloadFromConfig(c: CustomConfig): CustomConfigDraftPayload {
  return {
    name: c.name,
    proxies: c.proxies || [],
    proxy_groups: c.proxy_groups || [],
    rules: c.rules || [],
    rule_provider_ids: c.rule_provider_ids || [],
    hosted_rule_set_ids: c.hosted_rule_set_ids || [],
  }
}

type RuleSetReferenceItem = {
  id: number
  name: string
  behavior: string
  url?: string
  source: 'preset' | 'external' | 'hosted'
}

// ─────────────────────────────────────────────
// 代理节点协议类型
// ─────────────────────────────────────────────

type ProxyProtocol =
  | 'ss' | 'vmess' | 'vless' | 'trojan' | 'hysteria2'
  | 'tuic' | 'wireguard' | 'http' | 'socks5' | 'custom'

const PROXY_PROTOCOLS: ProxyProtocol[] = [
  'ss', 'vmess', 'vless', 'trojan', 'hysteria2',
  'tuic', 'wireguard', 'http', 'socks5', 'custom',
]

// 代理节点表单字段状态
interface ProxyFormState {
  name: string
  type: ProxyProtocol
  server: string
  port: string
  // ss
  cipher: string
  password: string
  udp: boolean
  // vmess
  uuid: string
  alterId: string
  network: string
  tls: boolean
  // vless
  flow: string
  // trojan
  sni: string
  skipCertVerify: boolean
  // tuic
  version: string
  // wireguard
  ip: string
  privateKey: string
  publicKey: string
  wgDns: string
  mtu: string
  // http/socks5
  username: string
  // 原始 YAML 编辑
  rawYaml: string
}

const defaultProxyForm: ProxyFormState = {
  name: '',
  type: 'ss',
  server: '',
  port: '',
  cipher: 'aes-128-gcm',
  password: '',
  udp: false,
  uuid: '',
  alterId: '0',
  network: 'tcp',
  tls: false,
  flow: '',
  sni: '',
  skipCertVerify: false,
  version: '5',
  ip: '',
  privateKey: '',
  publicKey: '',
  wgDns: '',
  mtu: '',
  username: '',
  rawYaml: '',
}

/** 将 ProxyNode 对象映射到表单字段 */
function proxyNodeToForm(node: ProxyNode): ProxyFormState {
  const type = (node.type as ProxyProtocol) || 'ss'
  return {
    name: node.name || '',
    type,
    server: String(node.server || ''),
    port: String(node.port || ''),
    cipher: String(node.cipher || (type === 'ss' ? 'aes-128-gcm' : 'auto')),
    password: String(node.password || ''),
    udp: Boolean(node.udp),
    uuid: String(node.uuid || ''),
    alterId: String(node.alterId ?? '0'),
    network: String(node.network || 'tcp'),
    tls: Boolean(node.tls),
    flow: String(node.flow || ''),
    sni: String(node.sni || ''),
    skipCertVerify: Boolean(node['skip-cert-verify']),
    version: String(node.version ?? '5'),
    ip: String(node.ip || ''),
    privateKey: String(node['private-key'] || ''),
    publicKey: String(node['public-key'] || ''),
    wgDns: String(node.dns || ''),
    mtu: String(node.mtu || ''),
    username: String(node.username || ''),
    rawYaml: node.__raw__ ? String(node.__raw__) : proxyToYaml(node as Record<string, unknown>),
  }
}

/** 将表单字段转换为 ProxyNode 对象 */
function formToProxyNode(form: ProxyFormState): ProxyNode {
  if (form.type === 'custom') {
    return { name: form.name, type: 'custom', __raw__: form.rawYaml }
  }
  const base: Record<string, unknown> = {
    name: form.name,
    type: form.type,
    server: form.server,
    port: parseInt(form.port) || 0,
  }
  if (form.type === 'ss') {
    base.cipher = form.cipher
    base.password = form.password
    if (form.udp) base.udp = true
  } else if (form.type === 'vmess') {
    base.uuid = form.uuid
    base.alterId = parseInt(form.alterId) || 0
    base.cipher = form.cipher
    if (form.tls) base.tls = true
    base.network = form.network
  } else if (form.type === 'vless') {
    base.uuid = form.uuid
    if (form.tls) base.tls = true
    base.network = form.network
    if (form.flow) base.flow = form.flow
  } else if (form.type === 'trojan') {
    base.password = form.password
    if (form.sni) base.sni = form.sni
    if (form.skipCertVerify) base['skip-cert-verify'] = true
  } else if (form.type === 'hysteria2') {
    base.password = form.password
    if (form.sni) base.sni = form.sni
    if (form.skipCertVerify) base['skip-cert-verify'] = true
  } else if (form.type === 'tuic') {
    base.uuid = form.uuid
    base.password = form.password
    base.version = parseInt(form.version) || 5
    if (form.sni) base.sni = form.sni
    if (form.skipCertVerify) base['skip-cert-verify'] = true
  } else if (form.type === 'wireguard') {
    base.ip = form.ip
    base['private-key'] = form.privateKey
    base['public-key'] = form.publicKey
    if (form.wgDns) base.dns = form.wgDns
    if (form.mtu) base.mtu = parseInt(form.mtu)
  } else if (form.type === 'http' || form.type === 'socks5') {
    if (form.username) base.username = form.username
    if (form.password) base.password = form.password
    if (form.tls) base.tls = true
  }
  return base as ProxyNode
}

/** 生成不冲突的副本名称：`原名 副本`、`原名 副本 2` … */
function makeUniqueDuplicateProxyName(
  baseName: string,
  copySuffix: string,
  proxies: ProxyNode[],
  proxyGroups: ProxyGroup[]
): string {
  const base = baseName.trim() || 'proxy'
  let candidate = `${base} ${copySuffix}`
  let n = 2
  while (hasProxyOrGroupNameConflict(candidate, proxies, proxyGroups)) {
    candidate = `${base} ${copySuffix} ${n}`
    n++
  }
  return candidate
}

/** 列表快速复制：表单态重建节点并同步自定义 YAML 内名称 */
function buildDuplicatedProxyNode(proxy: ProxyNode, newName: string): ProxyNode {
  const form = proxyNodeToForm(proxy)
  form.name = newName
  if (form.type === 'custom' && form.rawYaml.trim()) {
    form.rawYaml = replaceProxyYamlNameLine(form.rawYaml, newName)
  }
  return formToProxyNode(form)
}

// ─────────────────────────────────────────────
// 内部组件：代理节点编辑弹窗
// ─────────────────────────────────────────────

interface ProxyDialogProps {
  open: boolean
  initialNode: ProxyNode | null  // null = 新建
  onClose: () => void
  onSave: (node: ProxyNode) => void
}

function ProxyDialog({ open, initialNode, onClose, onSave }: ProxyDialogProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<ProxyFormState>(defaultProxyForm)
  // 是否显示 YAML 编辑模式
  const [yamlMode, setYamlMode] = useState(false)

  // 打开/初始化时重置表单
  useEffect(() => {
    if (open) {
      if (initialNode) {
        setForm(proxyNodeToForm(initialNode))
        setYamlMode(initialNode.type === 'custom')
      } else {
        setForm(defaultProxyForm)
        setYamlMode(false)
      }
    }
  }, [open, initialNode])

  const set = <K extends keyof ProxyFormState>(key: K, val: ProxyFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }))

  // 切换到 YAML 模式：先把当前表单序列化
  const switchToYaml = () => {
    const node = formToProxyNode(form)
    const yaml =
      form.type === 'custom'
        ? form.rawYaml
        : proxyToYaml(node as Record<string, unknown>)
    setForm((prev) => ({ ...prev, rawYaml: yaml }))
    setYamlMode(true)
  }

  // 切换回表单模式：解析 YAML
  const switchToForm = () => {
    try {
      const parsed = yamlToProxy(form.rawYaml)
      const newType = (parsed.type as ProxyProtocol) || form.type
      const reconstructed: ProxyNode = { name: form.name, type: newType, ...parsed }
      setForm(proxyNodeToForm(reconstructed))
    } catch {
      toast.error('YAML 解析失败，请检查格式')
    }
    setYamlMode(false)
  }

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error(t('customConfigs.proxyName') + ' ' + t('common.required'))
      return
    }
    let node: ProxyNode
    if (yamlMode) {
      // YAML 模式下直接解析
      const parsed = yamlToProxy(form.rawYaml)
      node = {
        name: form.name,
        type: (parsed.type as string) || form.type,
        ...parsed,
      }
    } else {
      node = formToProxyNode(form)
    }
    onSave(node)
  }

  // 根据协议类型渲染特定字段
  const renderTypeFields = () => {
    const type = form.type
    if (type === 'custom') {
      return (
        <div className="space-y-2">
          <Label>{t('customConfigs.rawYaml')}</Label>
          <Textarea
            className="font-mono text-sm min-h-[200px]"
            value={form.rawYaml}
            onChange={(e) => set('rawYaml', e.target.value)}
            placeholder="# 完整代理节点 YAML"
          />
        </div>
      )
    }

    const commonFields = (
      <>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2 space-y-1">
            <Label>{t('customConfigs.proxyServer')}</Label>
            <Input value={form.server} onChange={(e) => set('server', e.target.value)} placeholder="1.2.3.4" />
          </div>
          <div className="space-y-1">
            <Label>{t('customConfigs.proxyPort')}</Label>
            <Input type="number" value={form.port} onChange={(e) => set('port', e.target.value)} placeholder="443" />
          </div>
        </div>
      </>
    )

    if (type === 'ss') {
      return (
        <>
          {commonFields}
          <div className="space-y-1">
            <Label>Cipher</Label>
            <Select value={form.cipher} onValueChange={(v) => set('cipher', v)}>
              <SelectTrigger type="button"><SelectValue /></SelectTrigger>
              <SelectContent>
                {['aes-128-gcm', 'aes-256-gcm', 'chacha20-ietf-poly1305'].map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Password</Label>
            <ProxyPasswordInput
              key="ss"
              inputName="proxy-ss-password"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="ss-udp" checked={form.udp} onCheckedChange={(v) => set('udp', !!v)} />
            <label htmlFor="ss-udp" className="text-sm cursor-pointer">UDP</label>
          </div>
        </>
      )
    }

    if (type === 'vmess') {
      return (
        <>
          {commonFields}
          <div className="space-y-1">
            <Label>UUID</Label>
            <Input value={form.uuid} onChange={(e) => set('uuid', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Alter ID</Label>
              <Input type="number" value={form.alterId} onChange={(e) => set('alterId', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Cipher</Label>
              <Select value={form.cipher} onValueChange={(v) => set('cipher', v)}>
                <SelectTrigger type="button"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['auto', 'aes-128-gcm', 'chacha20-poly1305', 'none'].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Network</Label>
              <Select value={form.network} onValueChange={(v) => set('network', v)}>
                <SelectTrigger type="button"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['tcp', 'ws', 'http', 'h2', 'grpc'].map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox id="vmess-tls" checked={form.tls} onCheckedChange={(v) => set('tls', !!v)} />
              <label htmlFor="vmess-tls" className="text-sm cursor-pointer">TLS</label>
            </div>
          </div>
        </>
      )
    }

    if (type === 'vless') {
      return (
        <>
          {commonFields}
          <div className="space-y-1">
            <Label>UUID</Label>
            <Input value={form.uuid} onChange={(e) => set('uuid', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Network</Label>
              <Select value={form.network} onValueChange={(v) => set('network', v)}>
                <SelectTrigger type="button"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['tcp', 'ws', 'http', 'grpc'].map((n) => (
                    <SelectItem key={n} value={n}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox id="vless-tls" checked={form.tls} onCheckedChange={(v) => set('tls', !!v)} />
              <label htmlFor="vless-tls" className="text-sm cursor-pointer">TLS</label>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Flow <span className="text-xs text-muted-foreground">({t('common.optional')})</span></Label>
            <Input value={form.flow} onChange={(e) => set('flow', e.target.value)} placeholder="xtls-rprx-vision" />
          </div>
        </>
      )
    }

    if (type === 'trojan') {
      return (
        <>
          {commonFields}
          <div className="space-y-1">
            <Label>Password</Label>
            <ProxyPasswordInput
              key="trojan"
              inputName="proxy-trojan-password"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>SNI <span className="text-xs text-muted-foreground">({t('common.optional')})</span></Label>
            <Input value={form.sni} onChange={(e) => set('sni', e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="trojan-skip" checked={form.skipCertVerify} onCheckedChange={(v) => set('skipCertVerify', !!v)} />
            <label htmlFor="trojan-skip" className="text-sm cursor-pointer">skip-cert-verify</label>
          </div>
        </>
      )
    }

    if (type === 'hysteria2') {
      return (
        <>
          {commonFields}
          <div className="space-y-1">
            <Label>Password</Label>
            <ProxyPasswordInput
              key="hysteria2"
              inputName="proxy-hysteria2-password"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>SNI <span className="text-xs text-muted-foreground">({t('common.optional')})</span></Label>
            <Input value={form.sni} onChange={(e) => set('sni', e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="hy2-skip" checked={form.skipCertVerify} onCheckedChange={(v) => set('skipCertVerify', !!v)} />
            <label htmlFor="hy2-skip" className="text-sm cursor-pointer">skip-cert-verify</label>
          </div>
        </>
      )
    }

    if (type === 'tuic') {
      return (
        <>
          {commonFields}
          <div className="space-y-1">
            <Label>UUID</Label>
            <Input value={form.uuid} onChange={(e) => set('uuid', e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Password</Label>
            <ProxyPasswordInput
              key="tuic"
              inputName="proxy-tuic-password"
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Version</Label>
              <Input type="number" value={form.version} onChange={(e) => set('version', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>SNI <span className="text-xs text-muted-foreground">({t('common.optional')})</span></Label>
              <Input value={form.sni} onChange={(e) => set('sni', e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="tuic-skip" checked={form.skipCertVerify} onCheckedChange={(v) => set('skipCertVerify', !!v)} />
            <label htmlFor="tuic-skip" className="text-sm cursor-pointer">skip-cert-verify</label>
          </div>
        </>
      )
    }

    if (type === 'wireguard') {
      return (
        <>
          {commonFields}
          <div className="space-y-1">
            <Label>Local IP</Label>
            <Input value={form.ip} onChange={(e) => set('ip', e.target.value)} placeholder="10.0.0.2/32" />
          </div>
          <div className="space-y-1">
            <Label>Private Key</Label>
            <Input value={form.privateKey} onChange={(e) => set('privateKey', e.target.value)} className="font-mono text-xs" />
          </div>
          <div className="space-y-1">
            <Label>Public Key</Label>
            <Input value={form.publicKey} onChange={(e) => set('publicKey', e.target.value)} className="font-mono text-xs" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>DNS <span className="text-xs text-muted-foreground">({t('common.optional')})</span></Label>
              <Input value={form.wgDns} onChange={(e) => set('wgDns', e.target.value)} placeholder="1.1.1.1" />
            </div>
            <div className="space-y-1">
              <Label>MTU <span className="text-xs text-muted-foreground">({t('common.optional')})</span></Label>
              <Input type="number" value={form.mtu} onChange={(e) => set('mtu', e.target.value)} placeholder="1420" />
            </div>
          </div>
        </>
      )
    }

    if (type === 'http' || type === 'socks5') {
      return (
        <>
          {commonFields}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Username <span className="text-xs text-muted-foreground">({t('common.optional')})</span></Label>
              <Input value={form.username} onChange={(e) => set('username', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Password <span className="text-xs text-muted-foreground">({t('common.optional')})</span></Label>
              <ProxyPasswordInput
                key="http-socks"
                inputName="proxy-http-socks-password"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="http-tls" checked={form.tls} onCheckedChange={(v) => set('tls', !!v)} />
            <label htmlFor="http-tls" className="text-sm cursor-pointer">TLS</label>
          </div>
        </>
      )
    }

    return null
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            handleSave()
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {initialNode ? t('customConfigs.editProxy') : t('customConfigs.addProxy')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
          {/* 节点名称（始终显示） */}
          <div className="space-y-1">
            <Label>{t('customConfigs.proxyName')}</Label>
            <Input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="my-proxy"
            />
          </div>

          {/* 协议类型（YAML 模式下仍可见） */}
          {!yamlMode && (
            <div className="space-y-1">
              <Label>{t('customConfigs.proxyType')}</Label>
              <Select
                value={form.type}
                onValueChange={(v) => {
                  set('type', v as ProxyProtocol)
                  if (v === 'custom') setYamlMode(true)
                }}
              >
                <SelectTrigger type="button"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROXY_PROTOCOLS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 主体内容：表单字段 或 YAML 编辑器 */}
          {yamlMode ? (
            <div className="space-y-2">
              <Label>{t('customConfigs.rawYaml')}</Label>
              <Textarea
                className="font-mono text-sm min-h-[240px]"
                value={form.rawYaml}
                onChange={(e) => set('rawYaml', e.target.value)}
              />
            </div>
          ) : (
            <div className="space-y-3">{renderTypeFields()}</div>
          )}
        </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {/* 切换按钮 */}
            {form.type !== 'custom' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mr-auto"
                onClick={yamlMode ? switchToForm : switchToYaml}
              >
                {yamlMode ? t('customConfigs.switchToForm') : t('customConfigs.switchToYaml')}
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit">{t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────
// 内部组件：代理组编辑弹窗
// ─────────────────────────────────────────────

interface ProxyGroupDialogProps {
  open: boolean
  initialGroup: ProxyGroup | null
  proxyNames: string[]    // 所有代理节点名称
  groupNames: string[]    // 其他代理组名称（排除自身）
  providerNames: string[] // 可供 use: 引用的订阅源名称
  onClose: () => void
  onSave: (group: ProxyGroup) => void
}

const GROUP_TYPES: ProxyGroup['type'][] = [
  'select', 'url-test', 'fallback', 'load-balance', 'relay',
]

const BUILTIN_PROXIES = ['DIRECT', 'REJECT']

interface GroupFormState {
  name: string
  type: ProxyGroup['type']
  proxies: string[]
  useProviders: string[] // 选中的订阅源名称列表
  url: string
  interval: string
  tolerance: string
  strategy: string
}

const defaultGroupForm: GroupFormState = {
  name: '',
  type: 'select',
  proxies: [],
  useProviders: [],
  url: 'http://www.gstatic.com/generate_204',
  interval: '300',
  tolerance: '50',
  strategy: 'consistent-hashing',
}

function groupToForm(g: ProxyGroup): GroupFormState {
  return {
    name: g.name,
    type: g.type,
    proxies: g.proxies || [],
    useProviders: g.use || [],
    url: g.url || 'http://www.gstatic.com/generate_204',
    interval: String(g.interval ?? 300),
    tolerance: String(g.tolerance ?? 50),
    strategy: g.strategy || 'consistent-hashing',
  }
}

/** 代理组成员弹窗内：已选成员单行（可拖拽排序） */
interface SortableGroupMemberRowProps {
  id: string
  name: string
  onRemove: (name: string) => void
}

function SortableGroupMemberRow({ id, name, onRemove }: SortableGroupMemberRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, ...sortableInstantReorder })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 rounded-md border border-border/60 bg-background px-2 py-1.5',
        isDragging && 'relative z-10 shadow-md'
      )}
    >
      <button
        type="button"
        className="flex h-8 w-7 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={() => onRemove(name)}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

function ProxyGroupDialog({
  open, initialGroup, proxyNames, groupNames, providerNames, onClose, onSave,
}: ProxyGroupDialogProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<GroupFormState>(defaultGroupForm)

  useEffect(() => {
    if (open) {
      setForm(initialGroup ? groupToForm(initialGroup) : defaultGroupForm)
    }
  }, [open, initialGroup])

  const set = <K extends keyof GroupFormState>(key: K, val: GroupFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }))

  const toggleProxy = (name: string) => {
    setForm((prev) => ({
      ...prev,
      proxies: prev.proxies.includes(name)
        ? prev.proxies.filter((p) => p !== name)
        : [...prev.proxies, name],
    }))
  }

  const removeProxyMember = (name: string) => {
    setForm((prev) => ({
      ...prev,
      proxies: prev.proxies.filter((p) => p !== name),
    }))
  }

  const groupMemberSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const handleGroupMembersDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setForm((prev) => {
      const items = prev.proxies
      const oldIndex = items.findIndex((_, j) => `gp-member-${j}` === String(active.id))
      const newIndex = items.findIndex((_, j) => `gp-member-${j}` === String(over.id))
      if (oldIndex < 0 || newIndex < 0) return prev
      return { ...prev, proxies: arrayMove(items, oldIndex, newIndex) }
    })
  }

  const toggleProvider = (name: string) => {
    setForm((prev) => ({
      ...prev,
      useProviders: prev.useProviders.includes(name)
        ? prev.useProviders.filter((p) => p !== name)
        : [...prev.useProviders, name],
    }))
  }

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error(t('customConfigs.groupName') + ' ' + t('common.required'))
      return
    }

    const group: ProxyGroup = {
      name: form.name,
      type: form.type,
    }
    if (form.proxies.length > 0) group.proxies = form.proxies
    if (form.useProviders.length > 0) group.use = form.useProviders
    if (form.type === 'url-test' || form.type === 'fallback' || form.type === 'load-balance') {
      group.url = form.url
      group.interval = parseInt(form.interval) || 300
      group.tolerance = parseInt(form.tolerance) || 50
    }
    if (form.type === 'load-balance') {
      group.strategy = form.strategy
    }
    onSave(group)
  }

  // 可选的节点/组列表：内置 + 代理节点 + 其他代理组
  const allProxyOptions = [...BUILTIN_PROXIES, ...proxyNames, ...groupNames]
  const availableProxyOptions = allProxyOptions.filter((n) => !form.proxies.includes(n))
  const sortableMemberIds = form.proxies.map((_, i) => `gp-member-${i}`)

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            handleSave()
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {initialGroup ? t('customConfigs.editProxyGroup') : t('customConfigs.addProxyGroup')}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* 名称 */}
            <div className="space-y-1">
              <Label>{t('customConfigs.groupName')}</Label>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>

          {/* 类型 */}
          <div className="space-y-1">
            <Label>{t('customConfigs.groupType')}</Label>
            <Select value={form.type} onValueChange={(v) => set('type', v as ProxyGroup['type'])}>
              <SelectTrigger type="button"><SelectValue /></SelectTrigger>
              <SelectContent>
                {GROUP_TYPES.map((gt) => (
                  <SelectItem key={gt} value={gt}>{gt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 成员节点：已选可排序 + 未选复选框 */}
          <div className="space-y-3">
            <Label>{t('customConfigs.groupProxies')}</Label>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t('customConfigs.groupProxiesSelected')}</p>
              <DndContext
                sensors={groupMemberSensors}
                collisionDetection={closestCorners}
                onDragEnd={handleGroupMembersDragEnd}
              >
                <SortableContext items={sortableMemberIds} strategy={verticalListSortingStrategy}>
                  <div className="max-h-40 min-h-[2.5rem] space-y-1 overflow-y-auto rounded-md border p-2">
                    {form.proxies.length === 0 ? (
                      <p className="py-1 text-xs text-muted-foreground">
                        {t('customConfigs.groupProxiesEmptyHint')}
                      </p>
                    ) : (
                      form.proxies.map((name, index) => (
                        <SortableGroupMemberRow
                          key={name}
                          id={`gp-member-${index}`}
                          name={name}
                          onRemove={removeProxyMember}
                        />
                      ))
                    )}
                  </div>
                </SortableContext>
              </DndContext>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t('customConfigs.groupProxiesAvailable')}</p>
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                {allProxyOptions.length === 0 && form.proxies.length === 0 ? (
                  <p className="py-1 text-xs text-muted-foreground">{t('common.noData')}</p>
                ) : availableProxyOptions.length === 0 ? (
                  <p className="py-1 text-xs text-muted-foreground">
                    {t('customConfigs.groupProxiesNothingToAdd')}
                  </p>
                ) : (
                  availableProxyOptions.map((name) => (
                    <div key={name} className="flex items-center gap-2">
                      <Checkbox
                        id={`gp-pool-${name}`}
                        checked={false}
                        onCheckedChange={() => toggleProxy(name)}
                      />
                      <label htmlFor={`gp-pool-${name}`} className="cursor-pointer text-sm">
                        {name}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 引用订阅源（复选框多选） */}
          <div className="space-y-1">
            <Label>{t('customConfigs.groupUse')}</Label>
            {providerNames.length === 0 ? (
              <p className="text-xs text-muted-foreground border rounded-md px-3 py-2">
                {t('subscriptions.noProviders')}
              </p>
            ) : (
              <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                {providerNames.map((pName) => (
                  <div key={pName} className="flex items-center gap-2">
                    <Checkbox
                      id={`use-${pName}`}
                      checked={form.useProviders.includes(pName)}
                      onCheckedChange={() => toggleProvider(pName)}
                    />
                    <label htmlFor={`use-${pName}`} className="text-sm cursor-pointer">{pName}</label>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{t('customConfigs.groupUseHint')}</p>
            {form.useProviders.length > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                ⚠️ 请确保在订阅管理 →「订阅源」Tab 中同时启用这些订阅源，否则生成时节点为空。
              </p>
            )}
          </div>

          {/* 条件字段：url-test / fallback / load-balance */}
          {(form.type === 'url-test' || form.type === 'fallback' || form.type === 'load-balance') && (
            <>
              <div className="space-y-1">
                <Label>{t('customConfigs.groupUrl')}</Label>
                <Input value={form.url} onChange={(e) => set('url', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>{t('customConfigs.groupInterval')}</Label>
                  <Input type="number" value={form.interval} onChange={(e) => set('interval', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>{t('customConfigs.groupTolerance')}</Label>
                  <Input type="number" value={form.tolerance} onChange={(e) => set('tolerance', e.target.value)} />
                </div>
              </div>
            </>
          )}

          {/* load-balance 专有：strategy */}
          {form.type === 'load-balance' && (
            <div className="space-y-1">
              <Label>{t('customConfigs.groupStrategy')}</Label>
              <Select value={form.strategy} onValueChange={(v) => set('strategy', v)}>
                <SelectTrigger type="button"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['consistent-hashing', 'round-robin', 'sticky-sessions'].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit">{t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// 自定义配置详情页 Tab，与 URL ?tab= 同步以便刷新保留
const CONFIG_DETAIL_TABS = ['proxies', 'proxyGroups', 'rules', 'ruleSets'] as const
type ConfigDetailTab = (typeof CONFIG_DETAIL_TABS)[number]

function parseConfigDetailTab(raw: string | null): ConfigDetailTab {
  if (raw && (CONFIG_DETAIL_TABS as readonly string[]).includes(raw)) {
    return raw as ConfigDetailTab
  }
  return 'proxies'
}

/** 未保存时离开路由的确认弹窗（配合 useBlocker） */
function CustomConfigLeaveDialog({ blocker }: { blocker: Blocker }) {
  const { t } = useTranslation()
  const open = blocker.state === 'blocked'

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) blocker.reset?.()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('contextSaveBar.leaveTitle')}</DialogTitle>
          <DialogDescription>{t('contextSaveBar.leaveDescription')}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => blocker.reset?.()}>
            {t('contextSaveBar.stay')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => blocker.proceed?.()}
          >
            {t('contextSaveBar.leave')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─────────────────────────────────────────────
// 主页面组件
// ─────────────────────────────────────────────

export function CustomConfigDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const configId = Number(id)
  const activeTab = parseConfigDetailTab(searchParams.get('tab'))

  const handleDetailTabChange = (value: string) => {
    const next = parseConfigDetailTab(value)
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next === 'proxies') {
          p.delete('tab')
        } else {
          p.set('tab', next)
        }
        return p
      },
      { replace: true }
    )
  }

  // ── 页面级状态 ──
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState('')

  // 代理节点列表
  const [proxies, setProxies] = useState<ProxyNode[]>([])
  // 代理组列表
  const [proxyGroups, setProxyGroups] = useState<ProxyGroup[]>([])
  // 规则列表（字符串数组）
  const [rules, setRules] = useState<string[]>([])
  // 已选规则集 ID
  const [ruleProviderIds, setRuleProviderIds] = useState<number[]>([])
  const [hostedRuleSetIds, setHostedRuleSetIds] = useState<number[]>([])

  // 代理节点弹窗状态
  const [proxyDialogOpen, setProxyDialogOpen] = useState(false)
  const [editingProxy, setEditingProxy] = useState<ProxyNode | null>(null)
  const [editingProxyIndex, setEditingProxyIndex] = useState<number>(-1)

  // 代理组弹窗状态
  const [groupDialogOpen, setGroupDialogOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState<ProxyGroup | null>(null)
  const [editingGroupIndex, setEditingGroupIndex] = useState<number>(-1)

  // 规则编辑状态
  const [rulesTextMode, setRulesTextMode] = useState(false)
  const [rulesText, setRulesText] = useState('')
  const [ruleSearch, setRuleSearch] = useState('')
  const [ruleFilter, setRuleFilter] = useState<RuleFilterValue>('all')
  const [showOnlyIssues, setShowOnlyIssues] = useState(false)
  const [activeRuleIndex, setActiveRuleIndex] = useState<number | null>(null)
  const [selectedDiagnosticLine, setSelectedDiagnosticLine] = useState<number | null>(null)
  const [lastValidationState, setLastValidationState] = useState<'idle' | 'valid' | 'warning' | 'error'>('idle')

  // YAML 预览面板
  const [previewOpen, setPreviewOpen] = useState(false)
  const [diffPreviewOpen, setDiffPreviewOpen] = useState(false)
  const [previewYaml, setPreviewYaml] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)

  // ── 数据查询 ──
  const { data: config, isLoading } = useQuery({
    queryKey: ['custom-configs', configId],
    queryFn: () => customConfigsApi.get(configId),
    enabled: !!configId,
  })

  const { data: allRuleProviders = [] } = useQuery({
    queryKey: ['rule-providers'],
    queryFn: ruleProvidersApi.list,
  })
  const { data: allHostedRuleSets = [] } = useQuery({
    queryKey: ['hosted-rule-sets'],
    queryFn: hostedRuleSetsApi.list,
  })

  // 加载所有订阅源，供代理组"引用订阅源"选择
  const { data: allProviders = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: providersApi.list,
  })
  const providerNames = allProviders.map((p) => p.name)

  // 从服务端同步到表单：仅在「配置 id / 服务端版本」变化时执行，避免 React Query refetch
  // 返回新对象引用时误重置草稿，导致 isDirty 恒为 false、Context Save Bar 不出现。
  useEffect(() => {
    if (!config) return
    setName(config.name)
    setProxies(config.proxies || [])
    setProxyGroups(config.proxy_groups || [])
    setRules(config.rules || [])
    setRulesText((config.rules || []).join('\n'))
    setRuleProviderIds(config.rule_provider_ids || [])
    setHostedRuleSetIds(config.hosted_rule_set_ids || [])
  }, [config?.id, config?.updated_at])

  useEffect(() => {
    if (!rulesTextMode) {
      setRulesText(rules.join('\n'))
    }
  }, [rules, rulesTextMode])

  // ── 保存 mutation ──
  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof customConfigsApi.update>[1]) =>
      customConfigsApi.update(configId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-configs', configId] })
      queryClient.invalidateQueries({ queryKey: ['custom-configs'] })
      toast.success(t('customConfigs.saveSuccess'))
      setEditingName(false)
      setLastValidationState('idle')
      setDiffPreviewOpen(false)
    },
    onError: () => toast.error(t('common.error')),
  })

  const isDirty = useMemo(() => {
    if (!config) return false
    const saved = savedPayloadFromConfig(config)
    const draft: CustomConfigDraftPayload = {
      name,
      proxies,
      proxy_groups: proxyGroups,
      rules: rulesFromDraft(rulesTextMode, rulesText, rules),
      rule_provider_ids: ruleProviderIds,
      hosted_rule_set_ids: hostedRuleSetIds,
    }
    return !equal(draft, saved)
  }, [
    config,
    name,
    proxies,
    proxyGroups,
    rules,
    ruleProviderIds,
    hostedRuleSetIds,
    rulesTextMode,
    rulesText,
  ])

  const handleDiscard = useCallback(() => {
    if (!config) return
    setName(config.name)
    setProxies(config.proxies || [])
    setProxyGroups(config.proxy_groups || [])
    setRules(config.rules || [])
    setRulesText((config.rules || []).join('\n'))
    setRuleProviderIds(config.rule_provider_ids || [])
    setHostedRuleSetIds(config.hosted_rule_set_ids || [])
    setEditingName(false)
    setLastValidationState('idle')
    setDiffPreviewOpen(false)
  }, [config])

  const openDiffPreview = useCallback(() => {
    setDiffPreviewOpen(true)
  }, [])

  /** 与 isDirty 一致的草稿快照，供 diff 弹窗使用 */
  const draftPayload = useMemo(
    (): CustomConfigDraftPayload => ({
      name,
      proxies,
      proxy_groups: proxyGroups,
      rules: rulesFromDraft(rulesTextMode, rulesText, rules),
      rule_provider_ids: ruleProviderIds,
      hosted_rule_set_ids: hostedRuleSetIds,
    }),
    [name, proxies, proxyGroups, rules, ruleProviderIds, hostedRuleSetIds, rulesTextMode, rulesText]
  )

  // ── YAML 预览 ──
  const handleOpenPreview = async () => {
    setPreviewOpen(true)
    await refreshPreview()
  }

  const refreshPreview = async () => {
    setPreviewLoading(true)
    try {
      const yaml = await customConfigsApi.preview(configId)
      setPreviewYaml(yaml)
    } catch {
      setPreviewYaml('# 预览生成失败')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleCopyPreview = async () => {
    try {
      await navigator.clipboard.writeText(previewYaml)
      toast.success(t('common.copied'))
    } catch {
      toast.error(t('common.error'))
    }
  }

  // ── 代理节点操作 ──
  const openAddProxy = () => {
    setEditingProxy(null)
    setEditingProxyIndex(-1)
    setProxyDialogOpen(true)
  }

  const openEditProxy = (node: ProxyNode, idx: number) => {
    setEditingProxy(node)
    setEditingProxyIndex(idx)
    setProxyDialogOpen(true)
  }

  const handleSaveProxy = (node: ProxyNode) => {
    const newName = node.name.trim()
    if (editingProxyIndex >= 0) {
      const oldName = editingProxy?.name.trim() ?? ''
      const renaming = oldName !== '' && oldName !== newName
      if (renaming) {
        if (
          hasProxyOrGroupNameConflict(newName, proxies, proxyGroups, {
            kind: 'proxy',
            index: editingProxyIndex,
          })
        ) {
          toast.error(t('customConfigs.renameConflict'))
          return
        }
        const { proxyGroups: pg, rules: r, rulesText: rt, replaceCount } = renameProxyOrGroupRefs(
          oldName,
          newName,
          { proxyGroups, rules, rulesText, rulesTextMode }
        )
        setProxyGroups(pg)
        setRules(r)
        setRulesText(rt)
        if (replaceCount > 0) {
          toast.success(t('customConfigs.renameRefsSynced', { count: replaceCount }))
        }
      }
      setProxies((prev) => prev.map((p, i) => (i === editingProxyIndex ? node : p)))
    } else {
      if (hasProxyOrGroupNameConflict(newName, proxies, proxyGroups)) {
        toast.error(t('customConfigs.renameConflict'))
        return
      }
      setProxies((prev) => [...prev, node])
    }
    setProxyDialogOpen(false)
  }

  const handleDeleteProxy = (idx: number) => {
    setProxies((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleDuplicateProxy = (idx: number) => {
    const proxy = proxies[idx]
    if (!proxy) return
    const suffix = t('customConfigs.proxyCopySuffix')
    const newName = makeUniqueDuplicateProxyName(proxy.name, suffix, proxies, proxyGroups)
    const node = buildDuplicatedProxyNode(proxy, newName)
    setProxies((prev) => [...prev.slice(0, idx + 1), node, ...prev.slice(idx + 1)])
    toast.success(t('customConfigs.proxyDuplicated'))
  }

  // ── 代理组操作 ──
  const openAddGroup = () => {
    setEditingGroup(null)
    setEditingGroupIndex(-1)
    setGroupDialogOpen(true)
  }

  const openEditGroup = (group: ProxyGroup, idx: number) => {
    setEditingGroup(group)
    setEditingGroupIndex(idx)
    setGroupDialogOpen(true)
  }

  const handleSaveGroup = (group: ProxyGroup) => {
    const newName = group.name.trim()
    if (editingGroupIndex >= 0) {
      const oldName = editingGroup?.name.trim() ?? ''
      const renaming = oldName !== '' && oldName !== newName
      if (renaming) {
        if (
          hasProxyOrGroupNameConflict(newName, proxies, proxyGroups, {
            kind: 'group',
            index: editingGroupIndex,
          })
        ) {
          toast.error(t('customConfigs.renameConflict'))
          return
        }
        const { proxyGroups: pg, rules: r, rulesText: rt, replaceCount } = renameProxyOrGroupRefs(
          oldName,
          newName,
          { proxyGroups, rules, rulesText, rulesTextMode }
        )
        setProxyGroups(pg.map((g, i) => (i === editingGroupIndex ? group : g)))
        setRules(r)
        setRulesText(rt)
        if (replaceCount > 0) {
          toast.success(t('customConfigs.renameRefsSynced', { count: replaceCount }))
        }
      } else {
        setProxyGroups((prev) => prev.map((g, i) => (i === editingGroupIndex ? group : g)))
      }
    } else {
      if (hasProxyOrGroupNameConflict(newName, proxies, proxyGroups)) {
        toast.error(t('customConfigs.renameConflict'))
        return
      }
      setProxyGroups((prev) => [...prev, group])
    }
    setGroupDialogOpen(false)
  }

  const handleDeleteGroup = (idx: number) => {
    setProxyGroups((prev) => prev.filter((_, i) => i !== idx))
  }

  // ── DnD 传感器 ──
  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: { distance: 5 },
  }))

  const handleRulesDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    let oldIndex = -1
    let newIndex = -1
    setRules((prev) => {
      oldIndex = prev.findIndex((_, j) => `rule-${j}` === active.id)
      newIndex = prev.findIndex((_, j) => `rule-${j}` === over.id)
      if (oldIndex < 0 || newIndex < 0) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
    if (oldIndex < 0 || newIndex < 0) return
    setActiveRuleIndex((a) => remapRuleIndexAfterMove(a, oldIndex, newIndex))
  }

  const handleProxyGroupsDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setProxyGroups((prev) => {
      const oldIndex = prev.findIndex((_, j) => `group-${j}` === active.id)
      const newIndex = prev.findIndex((_, j) => `group-${j}` === over.id)
      if (oldIndex < 0 || newIndex < 0) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
  }

  // ── 规则操作 ──
  const addRule = (template: keyof typeof RULE_TEMPLATE_MAP = 'DOMAIN') => {
    const result = insertRule(rules, template)
    setRules(result.rules)
    setActiveRuleIndex(result.inserted ? result.insertIndex : null)
  }

  const updateParsedRule = (idx: number, field: keyof ParsedRule, value: string) => {
    setRules((prev) => {
      const parsed = parseRule(prev[idx])
      if (field === 'type' && value === 'MATCH' && !canUseMatchType(prev, idx)) {
        toast.error(t('customConfigs.matchRuleUnique'))
        return prev
      }
      parsed[field] = value
      if (field === 'type' && value === 'MATCH') {
        parsed.payload = ''
      }
      return prev.map((r, i) => (i === idx ? ruleToString(parsed) : r))
    })
  }

  const deleteRule = (idx: number) => {
    setRules((prev) => prev.filter((_, i) => i !== idx))
    setActiveRuleIndex((prev) => {
      if (prev === null) return null
      if (prev === idx) return null
      return prev > idx ? prev - 1 : prev
    })
  }

  // 切换到文本模式：把数组序列化为换行字符串
  const switchToTextMode = () => {
    setRulesText(rules.join('\n'))
    setRulesTextMode(true)
  }

  // 切换回表格模式：解析文本
  const switchToTableMode = () => {
    const parsed = parseRulesText(rulesText)
    const nextRuleList = parsed.rules.map((rule, index) => ({
      sourceIndex: index,
      lineNumber: parsed.lineNumbers[index],
      analysis: buildRuleAnalysis(
        rule,
        {
          availableTargets,
          availableRuleProviders: availableRuleProviderNames,
          selectedRuleProviders: selectedRuleProviderNames,
          duplicateCount: parsed.rules.filter((candidate) => candidate === rule).length,
          isLastRule: index === parsed.rules.length - 1,
        }
      ),
    }))
    const firstError = nextRuleList.find((item) => item.analysis.status === 'error')
    if (firstError?.lineNumber) {
      setSelectedDiagnosticLine(firstError.lineNumber)
      setLastValidationState('error')
      toast.error(t('customConfigs.ruleTextFixErrorsFirst'))
      return
    }
    setRules(parsed.rules)
    setRulesTextMode(false)
    setSelectedDiagnosticLine(null)
  }

  const handleRulesTextChange = (value: string) => {
    setRulesText(value)
  }

  const normalizeMatchRuleOrder = () => {
    setRules((prev) => {
      const matchRules = prev.filter((rule) => parseRule(rule).type === 'MATCH')
      const otherRules = prev.filter((rule) => parseRule(rule).type !== 'MATCH')
      return [...otherRules, ...matchRules]
    })
  }

  const handleRuleQuickFix = (_sourceIndex: number, action: RuleQuickFixAction) => {
    if (action === 'move-match-to-bottom') {
      normalizeMatchRuleOrder()
      setActiveRuleIndex(rules.length - 1)
      return
    }
    if (action === 'go-rule-sets') {
      handleDetailTabChange('ruleSets')
      return
    }
    if (action === 'go-target-groups') {
      handleDetailTabChange('proxyGroups')
      return
    }
    if (action === 'go-target-proxies') {
      handleDetailTabChange('proxies')
    }
  }

  const allRuleSets = useMemo<RuleSetReferenceItem[]>(
    () => [
      ...allRuleProviders.map((rp) => ({
        id: rp.id,
        name: rp.name,
        behavior: rp.behavior,
        url: rp.url,
        source: (rp.is_preset ? 'preset' : 'external') as 'preset' | 'external',
      })),
      ...allHostedRuleSets.map((rs) => ({
        id: rs.id,
        name: rs.name,
        behavior: rs.behavior,
        url: rs.url,
        source: 'hosted' as const,
      })),
    ],
    [allHostedRuleSets, allRuleProviders]
  )

  // ── 规则集操作 ──
  const toggleRuleSet = (item: RuleSetReferenceItem) => {
    const selectedNames = new Set<string>([
      ...allRuleProviders.filter((rp) => ruleProviderIds.includes(rp.id)).map((rp) => rp.name),
      ...allHostedRuleSets.filter((rs) => hostedRuleSetIds.includes(rs.id)).map((rs) => rs.name),
    ])
    const isSelected = item.source === 'hosted'
      ? hostedRuleSetIds.includes(item.id)
      : ruleProviderIds.includes(item.id)

    if (!isSelected && selectedNames.has(item.name)) {
      toast.error(t('customConfigs.ruleSetDuplicateName'))
      return
    }

    if (item.source === 'hosted') {
      setHostedRuleSetIds((prev) => (
        prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
      ))
      return
    }

    setRuleProviderIds((prev) => (
      prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
    ))
  }

  // 所有代理节点名称（供代理组选择使用）
  const proxyNames = proxies.map((p) => p.name)
  const selectedRuleProviderNames = useMemo(() => new Set<string>([
    ...allRuleProviders.filter((rp) => ruleProviderIds.includes(rp.id)).map((rp) => rp.name),
    ...allHostedRuleSets.filter((rs) => hostedRuleSetIds.includes(rs.id)).map((rs) => rs.name),
  ]), [allHostedRuleSets, allRuleProviders, hostedRuleSetIds, ruleProviderIds])
  const availableRuleProviderNames = useMemo(
    () => new Set(allRuleSets.map((rp) => rp.name)),
    [allRuleSets]
  )
  const availableTargets = useMemo(
    () => new Set([
      ...BUILTIN_PROXIES,
      ...proxyGroups.map((g) => g.name),
      ...proxies.map((p) => p.name),
    ]),
    [proxyGroups, proxies]
  )
  const parsedRulesText = useMemo(() => parseRulesText(rulesText), [rulesText])
  const currentRuleStrings = rulesTextMode ? parsedRulesText.rules : rules
  const currentLineNumbers = rulesTextMode ? parsedRulesText.lineNumbers : undefined
  const ruleDuplicateCounts = useMemo(() => {
    const counts = new Map<string, number>()
    currentRuleStrings.forEach((rule) => {
      counts.set(rule, (counts.get(rule) || 0) + 1)
    })
    return counts
  }, [currentRuleStrings])
  const ruleListItems = useMemo<RuleListItem[]>(() => (
    currentRuleStrings.map((rule, index) => ({
      sourceIndex: index,
      lineNumber: currentLineNumbers?.[index],
      analysis: buildRuleAnalysis(
        rule,
        {
          availableTargets,
          availableRuleProviders: availableRuleProviderNames,
          selectedRuleProviders: selectedRuleProviderNames,
          duplicateCount: ruleDuplicateCounts.get(rule) || 1,
          isLastRule: index === currentRuleStrings.length - 1,
        }
      ),
    }))
  ), [
    availableRuleProviderNames,
    availableTargets,
    currentLineNumbers,
    currentRuleStrings,
    ruleDuplicateCounts,
    selectedRuleProviderNames,
  ])
  const filteredRuleListItems = useMemo(() => (
    ruleListItems.filter(({ analysis }) => {
      const search = ruleSearch.trim().toLowerCase()
      const inSearch = search === ''
        || analysis.rule.toLowerCase().includes(search)
        || analysis.parsed.type.toLowerCase().includes(search)
        || analysis.parsed.payload.toLowerCase().includes(search)
        || analysis.parsed.target.toLowerCase().includes(search)
      if (!inSearch) return false
      if (showOnlyIssues && analysis.status === 'valid') return false
      if (ruleFilter === 'all') return true
      return getRuleTypeMeta(analysis.parsed.type).category === ruleFilter
    })
  ), [ruleFilter, ruleListItems, ruleSearch, showOnlyIssues])
  const ruleStats = useMemo(() => ({
    total: ruleListItems.length,
    errors: ruleListItems.filter((item) => item.analysis.status === 'error').length,
    warnings: ruleListItems.filter((item) => item.analysis.status === 'warning').length,
    selectedRuleSets: ruleListItems.filter((item) => item.analysis.parsed.type === 'RULE-SET').length,
  }), [ruleListItems])
  const hasMatchRule = useMemo(
    () => hasMatchRuleInList(rules),
    [rules]
  )
  const matchRuleNeedsNormalize = useMemo(() => {
    const matchIndex = rules.findIndex((rule) => parseRule(rule).type === 'MATCH')
    return matchIndex >= 0 && matchIndex !== rules.length - 1
  }, [rules])
  const referencedTargets = useMemo(() => {
    const values = new Set<string>()
    ruleListItems.forEach(({ analysis }) => {
      if (analysis.parsed.target) values.add(analysis.parsed.target)
    })
    return [...values]
  }, [ruleListItems])
  const referencedRuleSets = useMemo(() => {
    const values = new Set<string>()
    ruleListItems.forEach(({ analysis }) => {
      if (analysis.parsed.type === 'RULE-SET' && analysis.parsed.payload) {
        values.add(analysis.parsed.payload)
      }
    })
    return [...values]
  }, [ruleListItems])
  const activeRuleItem = useMemo(() => {
    if (activeRuleIndex === null) return null
    return (
      filteredRuleListItems.find((item) => item.sourceIndex === activeRuleIndex)
        ?? ruleListItems.find((item) => item.sourceIndex === activeRuleIndex)
        ?? null
    )
  }, [activeRuleIndex, filteredRuleListItems, ruleListItems])
  const targetOptionGroups = useMemo<RuleTargetOptionGroup[]>(() => ([
    { key: 'builtin', label: t('customConfigs.targetBuiltin'), values: BUILTIN_PROXIES },
    { key: 'groups', label: t('customConfigs.targetProxyGroups'), values: proxyGroups.map((g) => g.name) },
    { key: 'proxies', label: t('customConfigs.targetProxies'), values: proxies.map((p) => p.name) },
  ]), [proxyGroups, proxies, t])
  const visibleRuleCount = filteredRuleListItems.length
  const hasActiveFilters = ruleSearch.trim() !== '' || ruleFilter !== 'all' || showOnlyIssues
  const saveHealth = buildRuleSaveChecklist(rulesFromDraft(rulesTextMode, rulesText, rules), currentRuleStrings, ruleListItems)
  const checklistItems = [
    {
      key: 'rulesets',
      ok: !ruleListItems.some((item) => item.analysis.errors.some((message) => message.includes('规则集')))
        && !ruleListItems.some((item) => item.analysis.warnings.some((message) => message.includes('尚未'))),
      label: t('customConfigs.ruleChecklistRuleSets'),
    },
    {
      key: 'targets',
      ok: !ruleListItems.some((item) => item.analysis.warnings.some((message) => message.includes('目标策略'))),
      label: t('customConfigs.ruleChecklistTargets'),
    },
    {
      key: 'match',
      ok: !matchRuleNeedsNormalize,
      label: t('customConfigs.ruleChecklistMatch'),
    },
  ]

  // 规则条数减少后避免展开下标悬空
  useEffect(() => {
    if (activeRuleIndex !== null && activeRuleIndex >= rules.length) {
      setActiveRuleIndex(null)
    }
  }, [activeRuleIndex, rules.length])

  const handleSave = useCallback(() => {
    if (!isDirty) return
    const finalRules = rulesFromDraft(rulesTextMode, rulesText, rules)
    const issues = buildRuleSaveChecklist(finalRules, currentRuleStrings, ruleListItems)
    if (issues === 'error') {
      setLastValidationState('error')
      toast.error(t('customConfigs.saveBlockedByErrors'))
      return
    }
    setLastValidationState(issues)
    updateMutation.mutate({
      name,
      proxies,
      proxy_groups: proxyGroups,
      rules: finalRules,
      rule_provider_ids: ruleProviderIds,
      hosted_rule_set_ids: hostedRuleSetIds,
    })
  }, [
    isDirty,
    rulesTextMode,
    rulesText,
    rules,
    currentRuleStrings,
    ruleListItems,
    t,
    updateMutation,
    name,
    proxies,
    proxyGroups,
    ruleProviderIds,
    hostedRuleSetIds,
  ])

  const saveBarExtraActions = useMemo(
    () =>
      config
        ? [
            {
              id: 'draft-diff',
              label: t('contextSaveBar.viewDiff'),
              icon: 'git-compare' as const,
              onClick: openDiffPreview,
            },
          ]
        : [],
    // 用 id 而非整个 config，避免 refetch 换新对象时反复触发注册 effect
    [config?.id, t, openDiffPreview]
  )

  useRegisterContextSaveBar({
    // 无未保存改动时不注册顶栏，避免单独露出无效的「差异」按钮
    enabled: !!config && !isLoading && isDirty,
    dirty: isDirty,
    saving: updateMutation.isPending,
    saveDisabled: !isDirty || updateMutation.isPending || !config,
    onSave: handleSave,
    onDiscard: handleDiscard,
    extraActions: saveBarExtraActions,
  })

  const shouldBlockNavigation = useCallback(
    ({
      currentLocation,
      nextLocation,
    }: {
      currentLocation: { pathname: string }
      nextLocation: { pathname: string }
    }) =>
      isDirty &&
      !!config &&
      !isLoading &&
      currentLocation.pathname !== nextLocation.pathname,
    [isDirty, config, isLoading]
  )

  const blocker = useBlocker(shouldBlockNavigation)

  // ── 加载/错误状态 ──
  if (isLoading) {
    return (
      <>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
        <CustomConfigLeaveDialog blocker={blocker} />
      </>
    )
  }

  if (!config) {
    return (
      <>
        <div className="text-center py-16 text-muted-foreground">配置不存在</div>
        <CustomConfigLeaveDialog blocker={blocker} />
      </>
    )
  }

  return (
    <>
    <div className="space-y-6">
      {/* ── 顶部操作栏 ── */}
      <div className="rounded-2xl border bg-background/95 p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="-ml-1 mt-1"
              onClick={() => navigate('/custom-configs')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div className="space-y-2">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-9 text-lg font-bold"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSave()
                      if (e.key === 'Escape') { setName(config.name); setEditingName(false) }
                    }}
                    autoFocus
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={!isDirty || updateMutation.isPending}
                    onClick={() => handleSave()}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => { setName(config.name); setEditingName(false) }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h1
                    className="text-2xl font-bold cursor-pointer rounded-sm outline-offset-2 hover:text-primary/90"
                    title={t('customConfigs.clickToEditTitle')}
                    onClick={() => setEditingName(true)}
                  >
                    {name}
                  </h1>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => setEditingName(true)}
                    aria-label={t('customConfigs.clickToEditTitle')}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {activeTab === 'rules' && (
                  <Badge
                    variant="outline"
                    className={cn(
                      'border',
                      saveHealth === 'error' && 'border-destructive/40 text-destructive',
                      saveHealth === 'warning' && 'border-amber-500/40 text-amber-700 dark:text-amber-300',
                      saveHealth === 'valid' && 'border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                    )}
                  >
                    {saveHealth === 'error'
                      ? t('customConfigs.validationErrorsBadge', { count: ruleStats.errors })
                      : saveHealth === 'warning'
                        ? t('customConfigs.validationWarningsBadge', { count: ruleStats.warnings })
                        : t('customConfigs.validationReady')}
                  </Badge>
                )}
                {lastValidationState !== 'idle' && (
                  <Badge variant="outline" className={cn(
                    lastValidationState === 'error' && 'border-destructive/40 text-destructive',
                    lastValidationState === 'warning' && 'border-amber-500/40 text-amber-700 dark:text-amber-300',
                    lastValidationState === 'valid' && 'border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                  )}>
                    {lastValidationState === 'error'
                      ? t('customConfigs.lastCheckError')
                      : lastValidationState === 'warning'
                        ? t('customConfigs.lastCheckWarning')
                        : t('customConfigs.lastCheckValid')}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            <Button variant="outline" onClick={handleOpenPreview}>
              <Eye className="mr-2 h-4 w-4" />
              {t('customConfigs.previewYaml')}
            </Button>
          </div>
        </div>
      </div>

      {/* ── 主体 Tabs（与 ?tab= 同步，刷新保留当前页） ── */}
      <Tabs value={activeTab} onValueChange={handleDetailTabChange}>
        <div className="overflow-x-auto pb-1">
          <TabsList>
            <TabsTrigger value="proxies">
              {t('customConfigs.tabProxies')}
              {proxies.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">{proxies.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="proxyGroups">
              {t('customConfigs.tabProxyGroups')}
              {proxyGroups.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">{proxyGroups.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="rules">
              {t('customConfigs.tabRules')}
              {rules.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">{rules.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="ruleSets">
              {t('customConfigs.tabRuleSets')}
              {ruleProviderIds.length + hostedRuleSetIds.length > 0 && (
                <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                  {ruleProviderIds.length + hostedRuleSetIds.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ── Tab 1: 代理节点 ── */}
        <TabsContent value="proxies" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={openAddProxy}>
              <Plus className="mr-2 h-4 w-4" />
              {t('customConfigs.addProxy')}
            </Button>
          </div>

          {proxies.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm border rounded-lg">
              {t('common.noData')}
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">{t('customConfigs.proxyName')}</th>
                    <th className="text-left px-4 py-2 font-medium">{t('customConfigs.proxyType')}</th>
                    <th className="w-[132px] px-4 py-2 font-medium text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {proxies.map((proxy, idx) => (
                    <tr
                      key={idx}
                      className="border-t hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => openEditProxy(proxy, idx)}
                    >
                      <td className="px-4 py-2 font-medium whitespace-nowrap">{proxy.name}</td>
                      <td className="px-4 py-2">
                        <Badge variant="secondary">{proxy.type}</Badge>
                      </td>
                      <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => openEditProxy(proxy, idx)}
                            aria-label={t('customConfigs.editProxy')}
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleDuplicateProxy(idx)}
                            aria-label={t('customConfigs.duplicateProxy')}
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteProxy(idx)}
                            aria-label={t('customConfigs.deleteProxy')}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Tab 2: 代理组 ── */}
        <TabsContent value="proxyGroups" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={openAddGroup}>
              <Plus className="mr-2 h-4 w-4" />
              {t('customConfigs.addProxyGroup')}
            </Button>
          </div>

          {proxyGroups.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm border rounded-lg">
              {t('common.noData')}
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <table className={SORTABLE_TABLE_LAYOUT}>
                <thead className="bg-muted/50">
                  <tr>
                    <th className="w-[28px] px-1 py-2" aria-hidden />
                    <th className="text-left px-4 py-2 font-medium">{t('customConfigs.groupName')}</th>
                    <th className="text-left px-4 py-2 font-medium">{t('customConfigs.groupType')}</th>
                    <th className="text-left px-4 py-2 font-medium">{t('customConfigs.groupProxies')}</th>
                    <th className="w-[100px] px-4 py-2 font-medium text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCorners}
                  onDragEnd={handleProxyGroupsDragEnd}
                >
                  <SortableContext
                    items={proxyGroups.map((_, i) => `group-${i}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    <tbody>
                      {proxyGroups.map((group, idx) => (
                        <SortableProxyGroupRow
                          key={`group-${idx}`}
                          id={`group-${idx}`}
                          group={group}
                          idx={idx}
                          onEdit={openEditGroup}
                          onDelete={handleDeleteGroup}
                        />
                      ))}
                    </tbody>
                  </SortableContext>
                </DndContext>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Tab 3: 规则 ── */}
        <TabsContent value="rules" className="space-y-4 mt-4">
          <div className="space-y-4">
            <div className="space-y-4">
              <div className="rounded-2xl border bg-background p-4 shadow-sm">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">{t('customConfigs.rulesWorkspaceTitle')}</h3>
                      <p className="text-xs text-muted-foreground">
                        {rulesTextMode
                          ? t('customConfigs.rulesWorkspaceTextHint')
                          : t('customConfigs.rulesWorkspaceStructuredHint')}
                      </p>
                    </div>
                    <div className="inline-flex rounded-xl border bg-muted/40 px-2 py-2">
                      <button
                        type="button"
                        className={cn(
                          'inline-flex h-8 min-w-[112px] items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors',
                          !rulesTextMode
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                        onClick={switchToTableMode}
                      >
                        {t('customConfigs.structuredRulesMode')}
                      </button>
                      <button
                        type="button"
                        className={cn(
                          'inline-flex h-8 min-w-[112px] items-center justify-center rounded-lg px-3 text-sm font-medium transition-colors',
                          rulesTextMode
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                        )}
                        onClick={switchToTextMode}
                      >
                        <FileText className="mr-1.5 h-3.5 w-3.5" />
                        {t('customConfigs.rawRulesMode')}
                      </button>
                    </div>
                  </div>

                  {!rulesTextMode && (
                    <div className="grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button onClick={() => addRule('DOMAIN')} size="sm">
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          {t('customConfigs.addRule')}
                        </Button>
                        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border bg-muted/20 p-1 px-1.5">
                          <span className="px-1 text-xs font-medium text-muted-foreground">
                            {t('customConfigs.quickInsert')}
                          </span>
                          {(Object.keys(RULE_TEMPLATE_MAP) as Array<keyof typeof RULE_TEMPLATE_MAP>).map((key) => (
                            <Button
                              key={key}
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              disabled={key === 'MATCH' && hasMatchRule}
                              onClick={() => addRule(key)}
                            >
                              {key}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="relative min-w-0">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          className="pl-9"
                          value={ruleSearch}
                          onChange={(e) => setRuleSearch(e.target.value)}
                          placeholder={t('customConfigs.ruleSearchPlaceholder')}
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {matchRuleNeedsNormalize && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={normalizeMatchRuleOrder}
                          >
                            <ArrowDownUp className="mr-1.5 h-3.5 w-3.5" />
                            {t('customConfigs.normalizeMatch')}
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant={showOnlyIssues ? 'secondary' : 'outline'}
                          onClick={() => setShowOnlyIssues((prev) => !prev)}
                        >
                          <CircleAlert className="mr-1.5 h-3.5 w-3.5" />
                          {t('customConfigs.onlyShowIssues')}
                        </Button>
                      </div>
                    </div>
                  )}

                  {!rulesTextMode && (
                    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/20 px-2 py-2">
                      <div className="flex items-center gap-2 px-1 py-2">
                        <ListFilter className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {t('customConfigs.ruleQuickFilter')}
                        </span>
                      </div>
                      {RULE_FILTER_OPTIONS.map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          size="sm"
                          variant={ruleFilter === option.value ? 'secondary' : 'outline'}
                          onClick={() => setRuleFilter(option.value)}
                        >
                          {t(option.labelKey)}
                        </Button>
                      ))}
                      {hasActiveFilters && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setRuleSearch('')
                            setRuleFilter('all')
                            setShowOnlyIssues(false)
                          }}
                        >
                          {t('customConfigs.clearFilters')}
                        </Button>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {t('customConfigs.visibleRules', { count: visibleRuleCount, total: ruleStats.total })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <button
                  type="button"
                  className="rounded-xl border bg-muted/10 p-3 text-left transition-colors hover:bg-muted/20"
                  onClick={() => {
                    setRuleFilter('all')
                    setShowOnlyIssues(false)
                  }}
                >
                  <p className="text-xs text-muted-foreground">{t('customConfigs.ruleStatTotal')}</p>
                  <p className="mt-2 text-2xl font-semibold">{ruleStats.total}</p>
                </button>
                <button
                  type="button"
                  className="rounded-xl border bg-muted/10 p-3 text-left transition-colors hover:bg-muted/20"
                  onClick={() => setRuleFilter('rule-set')}
                >
                  <p className="text-xs text-muted-foreground">{t('customConfigs.ruleStatRuleSets')}</p>
                  <p className="mt-2 text-2xl font-semibold">{ruleStats.selectedRuleSets}</p>
                </button>
                <button
                  type="button"
                  className="rounded-xl border bg-muted/10 p-3 text-left transition-colors hover:bg-amber-50"
                  onClick={() => {
                    setShowOnlyIssues(true)
                    setRuleFilter('all')
                  }}
                >
                  <p className="text-xs text-muted-foreground">{t('customConfigs.ruleStatWarnings')}</p>
                  <p className="mt-2 text-2xl font-semibold text-amber-600 dark:text-amber-300">
                    {ruleStats.warnings}
                  </p>
                </button>
                <button
                  type="button"
                  className="rounded-xl border bg-muted/10 p-3 text-left transition-colors hover:bg-destructive/5"
                  onClick={() => {
                    setShowOnlyIssues(true)
                    setRuleFilter('all')
                  }}
                >
                  <p className="text-xs text-muted-foreground">{t('customConfigs.ruleStatErrors')}</p>
                  <p className="mt-2 text-2xl font-semibold text-destructive">{ruleStats.errors}</p>
                </button>
              </div>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-3">
                  {rulesTextMode ? (
                    <div className="space-y-3">
                      <div className="rounded-2xl border bg-background p-3 shadow-sm">
                        <YamlEditor
                          value={rulesText}
                          onChange={handleRulesTextChange}
                          minHeight="420px"
                          highlightedLine={selectedDiagnosticLine}
                          placeholder={'DOMAIN,example.com,DIRECT\nGEOIP,CN,DIRECT\nMATCH,PROXY'}
                        />
                      </div>
                      <div className="rounded-2xl border bg-background p-4 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-semibold">{t('customConfigs.ruleDiagnostics')}</h4>
                            <p className="text-xs text-muted-foreground">
                              {t('customConfigs.ruleDiagnosticsHint')}
                            </p>
                          </div>
                          <Badge variant="outline">{ruleListItems.length}</Badge>
                        </div>
                        <div className="mt-3 space-y-2">
                          {ruleListItems.length === 0 ? (
                            <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
                          ) : (
                            ruleListItems.map((item) => (
                              <button
                                key={`text-rule-${item.sourceIndex}`}
                                type="button"
                                className={cn(
                                  'block w-full rounded-lg border px-3 py-3 text-left transition-colors',
                                  selectedDiagnosticLine === item.lineNumber && 'border-primary bg-accent/20'
                                )}
                                onClick={() => setSelectedDiagnosticLine(item.lineNumber ?? null)}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <p className="font-mono text-xs text-muted-foreground">
                                    L{item.lineNumber}: {item.analysis.rule}
                                  </p>
                                  <Badge variant="outline" className={cn('border', getRuleStatusTone(item.analysis.status))}>
                                    {getRuleStatusLabel(item.analysis.status, t)}
                                  </Badge>
                                </div>
                                {item.analysis.errors.map((message) => (
                                  <p key={`e-${message}`} className="mt-2 text-xs text-destructive">
                                    {message}
                                  </p>
                                ))}
                                {item.analysis.warnings.map((message) => (
                                  <p
                                    key={`w-${message}`}
                                    className="mt-2 text-xs text-amber-700 dark:text-amber-300"
                                  >
                                    {message}
                                  </p>
                                ))}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  ) : filteredRuleListItems.length === 0 ? (
                    <div className="rounded-2xl border border-dashed bg-background px-6 py-12 text-center">
                      <p className="text-sm font-medium">{t('customConfigs.noMatchingRules')}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t('customConfigs.noMatchingRulesHint')}
                      </p>
                    </div>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCorners}
                      onDragEnd={handleRulesDragEnd}
                    >
                      <SortableContext
                        items={filteredRuleListItems.map((item) => `rule-${item.sourceIndex}`)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-3">
                          {filteredRuleListItems.map((item) => (
                            <SortableRuleRow
                              key={`rule-${item.sourceIndex}`}
                              id={`rule-${item.sourceIndex}`}
                              item={item}
                              allRuleSets={allRuleSets}
                              targetOptionGroups={targetOptionGroups}
                              onUpdate={updateParsedRule}
                              onDelete={deleteRule}
                              isActive={activeRuleItem?.sourceIndex === item.sourceIndex}
                              onFocus={setActiveRuleIndex}
                              onQuickFix={handleRuleQuickFix}
                              t={t}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="rounded-2xl border bg-background p-4 shadow-sm">
                    <div className="flex items-center gap-2">
                      <PanelRightOpen className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <h4 className="text-sm font-semibold">{t('customConfigs.ruleContextTitle')}</h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t('customConfigs.ruleContextHint')}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border bg-muted/10 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <h5 className="text-sm font-semibold">{t('customConfigs.currentRuleCard')}</h5>
                        {activeRuleItem ? (
                          <Badge variant="outline" className={cn('border', getRuleStatusTone(activeRuleItem.analysis.status))}>
                            {getRuleStatusLabel(activeRuleItem.analysis.status, t)}
                          </Badge>
                        ) : null}
                      </div>
                      {!activeRuleItem ? (
                        <p className="mt-3 text-sm text-muted-foreground">{t('customConfigs.noActiveRule')}</p>
                      ) : (
                        <div className="mt-3 space-y-3">
                          <div className="rounded-lg bg-background px-3 py-2">
                            <p className="font-mono text-xs text-muted-foreground">
                              {activeRuleItem.analysis.rule}
                            </p>
                          </div>
                          {activeRuleItem.analysis.errors.map((message) => (
                            <p key={`active-e-${message}`} className="text-xs text-destructive">{message}</p>
                          ))}
                          {activeRuleItem.analysis.warnings.map((message) => (
                            <p key={`active-w-${message}`} className="text-xs text-amber-700 dark:text-amber-300">{message}</p>
                          ))}
                          {activeRuleItem.analysis.quickFixes.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {activeRuleItem.analysis.quickFixes.map((fix) => (
                                <Button
                                  key={`active-fix-${fix.type}`}
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRuleQuickFix(activeRuleItem.sourceIndex, fix.type)}
                                >
                                  {fix.label}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 border-t pt-4">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-semibold">{t('customConfigs.ruleContextRuleSets')}</h4>
                          <p className="text-xs text-muted-foreground">
                            {t('customConfigs.ruleContextRuleSetsHint')}
                          </p>
                        </div>
                        <Badge variant="outline">{referencedRuleSets.length}</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {referencedRuleSets.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
                        ) : (
                          referencedRuleSets.map((name) => {
                            const provider = allRuleSets.find((item) => item.name === name)
                            const selected = provider
                              ? provider.source === 'hosted'
                                ? hostedRuleSetIds.includes(provider.id)
                                : ruleProviderIds.includes(provider.id)
                              : false
                            return (
                              <button
                                key={name}
                                type="button"
                                onClick={() => handleDetailTabChange('ruleSets')}
                                className={cn(
                                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                                  selected ? 'border-border bg-secondary text-secondary-foreground' : 'bg-background',
                                  !provider && 'border-destructive/40 text-destructive',
                                  provider && !selected && 'border-amber-500/40 text-amber-700 dark:text-amber-300'
                                )}
                              >
                                {name}
                                {provider
                                  ? ` · ${
                                    provider.source === 'preset'
                                      ? t('ruleProviders.presetBadge')
                                      : provider.source === 'hosted'
                                        ? t('hostedRuleSets.customSection')
                                        : t('ruleProviders.customSection')
                                  }`
                                  : ` · ${t('customConfigs.ruleSetMissing')}`}
                              </button>
                            )
                          })
                        )}
                      </div>
                    </div>

                    <div className="mt-4 border-t pt-4">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-semibold">{t('customConfigs.ruleContextTargets')}</h4>
                          <p className="text-xs text-muted-foreground">
                            {t('customConfigs.ruleContextTargetsHint')}
                          </p>
                        </div>
                        <Badge variant="outline">{referencedTargets.length}</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {referencedTargets.length === 0 ? (
                          <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
                        ) : (
                          referencedTargets.map((name) => {
                            const isBuiltin = BUILTIN_PROXIES.includes(name)
                            const isGroup = proxyGroups.some((group) => group.name === name)
                            const isProxy = proxies.some((proxy) => proxy.name === name)
                            return (
                              <button
                                key={name}
                                type="button"
                                onClick={() => handleDetailTabChange(isProxy ? 'proxies' : 'proxyGroups')}
                                className={cn(
                                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                                  !isBuiltin && !isGroup && !isProxy && 'border-destructive/40 text-destructive'
                                )}
                              >
                                {name}
                                {isBuiltin
                                  ? ` · ${t('customConfigs.targetBuiltin')}`
                                  : isGroup
                                    ? ` · ${t('customConfigs.targetProxyGroups')}`
                                    : isProxy
                                      ? ` · ${t('customConfigs.targetProxies')}`
                                      : ` · ${t('customConfigs.ruleTargetMissing')}`}
                              </button>
                            )
                          })
                        )}
                      </div>
                    </div>

                    <div className="mt-4 border-t pt-4">
                      <div className="flex items-center gap-2">
                        {saveHealth === 'error' || saveHealth === 'warning' ? (
                          <CircleAlert className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                        ) : (
                          <CircleCheck className="h-4 w-4 text-emerald-600" />
                        )}
                        <h4 className="text-sm font-semibold">{t('customConfigs.ruleChecklistTitle')}</h4>
                      </div>
                      <div className="mt-3 space-y-2">
                        {checklistItems.map((item) => (
                          <div key={item.key} className="flex items-start gap-2 text-xs">
                            {item.ok ? (
                              <CircleCheck className="mt-0.5 h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <CircleAlert className="mt-0.5 h-3.5 w-3.5 text-amber-600 dark:text-amber-300" />
                            )}
                            <p className={item.ok ? 'text-muted-foreground' : 'text-foreground'}>{item.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ── Tab 4: 规则集引用 ── */}
        <TabsContent value="ruleSets" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{t('customConfigs.ruleSetHint')}</p>
            {allRuleSets.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const allProviderIds = allRuleProviders.map((rp) => rp.id)
                  const allHostedIds = allHostedRuleSets.map((rs) => rs.id)
                  const allSelected =
                    allProviderIds.every((id) => ruleProviderIds.includes(id)) &&
                    allHostedIds.every((id) => hostedRuleSetIds.includes(id))
                  setRuleProviderIds(allSelected ? [] : allProviderIds)
                  setHostedRuleSetIds(allSelected ? [] : allHostedIds)
                }}
              >
                {allRuleSets.every((rp) => (
                  rp.source === 'hosted' ? hostedRuleSetIds.includes(rp.id) : ruleProviderIds.includes(rp.id)
                ))
                  ? t('common.deselectAll')
                  : t('common.selectAll')}
              </Button>
            )}
          </div>

          {allRuleSets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm border rounded-lg">
              {t('common.noData')}
            </div>
          ) : (
            <>
              {/* 内置预设分组 */}
              {allRuleSets.some((rp) => rp.source === 'preset') && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    {t('ruleProviders.loyalsoldierSection')}
                  </h3>
                  <RuleProviderGroup
                    providers={allRuleSets.filter((rp) => rp.source === 'preset')}
                    ruleProviderIds={ruleProviderIds}
                    hostedRuleSetIds={hostedRuleSetIds}
                    onToggle={toggleRuleSet}
                  />
                </div>
              )}

              {/* 自定义规则集分组 */}
              {allRuleSets.some((rp) => rp.source === 'external') && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    {t('ruleProviders.customSection')}
                  </h3>
                  <RuleProviderGroup
                    providers={allRuleSets.filter((rp) => rp.source === 'external')}
                    ruleProviderIds={ruleProviderIds}
                    hostedRuleSetIds={hostedRuleSetIds}
                    onToggle={toggleRuleSet}
                  />
                </div>
              )}

              {allRuleSets.some((rp) => rp.source === 'hosted') && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    {t('hostedRuleSets.customSection')}
                  </h3>
                  <RuleProviderGroup
                    providers={allRuleSets.filter((rp) => rp.source === 'hosted')}
                    ruleProviderIds={ruleProviderIds}
                    hostedRuleSetIds={hostedRuleSetIds}
                    onToggle={toggleRuleSet}
                  />
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ── 代理节点编辑弹窗 ── */}
      <ProxyDialog
        open={proxyDialogOpen}
        initialNode={editingProxy}
        onClose={() => setProxyDialogOpen(false)}
        onSave={handleSaveProxy}
      />

      {/* ── 代理组编辑弹窗 ── */}
      <ProxyGroupDialog
        open={groupDialogOpen}
        initialGroup={editingGroup}
        proxyNames={proxyNames}
        groupNames={proxyGroups
          .map((g) => g.name)
          .filter((_, i) => i !== editingGroupIndex)}
        providerNames={providerNames}
        onClose={() => setGroupDialogOpen(false)}
        onSave={handleSaveGroup}
      />

      {/* ── YAML 预览 Sheet ── */}
      <ConfigPayloadDiffDialog
        open={diffPreviewOpen}
        onOpenChange={setDiffPreviewOpen}
        saved={savedPayloadFromConfig(config)}
        draft={draftPayload}
      />

      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
        <SheetContent
          resizable
          defaultWidth={720}
          minWidth={520}
          maxWidth={1200}
          showClose={false}
          className="overflow-hidden"
        >
          <SheetHeader className="sticky top-0 z-10 shrink-0 bg-background">
            <div className="flex flex-wrap items-start justify-between gap-4 pr-2">
              <div className="space-y-2">
                <SheetTitle>{t('customConfigs.previewYaml')}</SheetTitle>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{t('customConfigs.previewRulesCount', { count: ruleStats.total })}</Badge>
                  <Badge variant="outline">{t('customConfigs.previewGroupsCount', { count: proxyGroups.length })}</Badge>
                  <Badge variant="outline">
                    {t('customConfigs.previewRuleSetsCount', { count: ruleProviderIds.length + hostedRuleSetIds.length })}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={refreshPreview} disabled={previewLoading}>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  {t('customConfigs.refreshPreview')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyPreview}
                  disabled={!previewYaml || previewLoading}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  {t('customConfigs.copyPreview')}
                </Button>
                <SheetClose className="rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                  <X className="h-5 w-5" />
                  <span className="sr-only">关闭</span>
                </SheetClose>
              </div>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-6 pt-4">
            {previewLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
                <p className="text-sm text-muted-foreground text-center pt-4">
                  {t('customConfigs.previewLoading')}
                </p>
              </div>
            ) : (
              <YamlEditor
                value={previewYaml}
                readOnly
                minHeight="480px"
                className="bg-muted/30"
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
    <CustomConfigLeaveDialog blocker={blocker} />
    </>
  )
}

// ─────────────────────────────────────────────
// 辅助组件：规则集列表（带复选框）
// ─────────────────────────────────────────────

interface RuleProviderGroupProps {
  providers: RuleSetReferenceItem[]
  ruleProviderIds: number[]
  hostedRuleSetIds: number[]
  onToggle: (item: RuleSetReferenceItem) => void
}

function RuleProviderGroup({ providers, ruleProviderIds, hostedRuleSetIds, onToggle }: RuleProviderGroupProps) {
  const { t } = useTranslation()
  return (
    <div className="border rounded-lg overflow-hidden">
      {providers.map((rp, idx) => (
        <div
          key={rp.id}
          className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer ${idx !== 0 ? 'border-t' : ''}`}
          onClick={() => onToggle(rp)}
        >
          <Checkbox
            checked={rp.source === 'hosted' ? hostedRuleSetIds.includes(rp.id) : ruleProviderIds.includes(rp.id)}
            onCheckedChange={() => onToggle(rp)}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{rp.name}</span>
              {rp.source === 'preset' && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  {t('ruleProviders.presetBadge')}
                </Badge>
              )}
              {rp.source === 'hosted' && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  {t('hostedRuleSets.customSection')}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs px-1.5 py-0">{rp.behavior}</Badge>
            </div>
            {rp.url && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{rp.url}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
