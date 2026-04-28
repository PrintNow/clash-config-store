import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
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
import type { ProxyNode, ProxyGroup } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  TooltipProvider,
} from '@/components/ui/tooltip'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
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
  type ParsedRule,
  parseRulesText,
  type RuleQuickFixAction,
  RULE_TEMPLATE_MAP,
  ruleSupportsNoResolve,
  ruleToString,
} from '@/domain/rules'

// ── 拆分后的子模块 ──
import { getRuleTypeMeta } from './rules/RuleTypeMeta'
import { RuleStatusIndicator } from './rules/RuleStatusIndicator'
import { SortableRuleRow } from './rules/SortableRuleRow'
import { ProxyDialog } from './proxies/ProxyDialog'
import { ProxyGroupDialog } from './proxies/ProxyGroupDialog'
import {
  makeUniqueDuplicateProxyName,
  buildDuplicatedProxyNode,
} from './proxies/proxy-form'
import {
  SORTABLE_TABLE_LAYOUT,
  sortableInstantReorder,
  rulesFromDraft,
  remapRuleIndexAfterMove,
  savedPayloadFromConfig,
  parseConfigDetailTab,
  BUILTIN_PROXIES,
  RULE_FILTER_OPTIONS,
  type RuleListItem,
  type RuleTargetOptionGroup,
  type RuleFilterValue,
  type RuleSetReferenceItem,
  type CustomConfigDraftPayload,
} from './shared/constants'


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
  /** 规则列表拖拽结束时间戳（用于抑制误点） */
  const lastRulesDragEndAtRef = useRef(0)
  /** 最近一次拖拽的规则 sourceIndex，仅该行在短时间内的标题点击会被忽略 */
  const lastDraggedRuleSourceIndexRef = useRef<number | null>(null)
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

  const toggleRuleRow = useCallback((sourceIndex: number) => {
    const now = Date.now()
    if (
      now - lastRulesDragEndAtRef.current < 400
      && lastDraggedRuleSourceIndexRef.current === sourceIndex
    ) {
      return
    }
    setActiveRuleIndex((prev) => (prev === sourceIndex ? null : sourceIndex))
  }, [])

  const handleRulesDragEnd = (event: DragEndEvent) => {
    lastRulesDragEndAtRef.current = Date.now()
    const idStr = String(event.active.id)
    const m = /^rule-(\d+)$/.exec(idStr)
    lastDraggedRuleSourceIndexRef.current = m ? Number(m[1]) : null
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

  const updateParsedRule = (idx: number, field: keyof ParsedRule, value: string | boolean) => {
    setRules((prev) => {
      const parsed = parseRule(prev[idx])
      if (field === 'type' && value === 'MATCH' && !canUseMatchType(prev, idx)) {
        toast.error(t('customConfigs.matchRuleUnique'))
        return prev
      }
      if (field === 'noResolve') {
        parsed.noResolve = Boolean(value)
      } else {
        parsed[field] = value as string
      }
      if (field === 'type' && value === 'MATCH') {
        parsed.payload = ''
      }
      if (
        field === 'type'
        && typeof value === 'string'
        && (value === 'MATCH' || !ruleSupportsNoResolve(value))
      ) {
        parsed.noResolve = false
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
      ok: !ruleListItems.some((item) => item.analysis.errors.some((msg) => msg.key === 'customConfigs.ruleAnalysis.ruleSetNotFound'))
        && !ruleListItems.some((item) => item.analysis.warnings.some((msg) => msg.key === 'customConfigs.ruleAnalysis.ruleSetNotSelected')),
      label: t('customConfigs.ruleChecklistRuleSets'),
    },
    {
      key: 'targets',
      ok: !ruleListItems.some((item) => item.analysis.warnings.some((msg) => msg.key === 'customConfigs.ruleAnalysis.targetNotFound')),
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
        <div className="space-y-4">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-9 w-full" />
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
    <div className="space-y-4">
      {/* ── 顶部操作栏 ── */}
      <div className="rounded-xl border bg-background/95 p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-2.5">
            <Button
              variant="ghost"
              size="icon"
              className="-ml-1 mt-0.5"
              onClick={() => navigate('/custom-configs')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div className="space-y-1.5">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-8 text-base font-bold"
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
                    className="text-xl font-bold leading-tight cursor-pointer rounded-sm outline-offset-2 hover:text-primary/90"
                    title={t('customConfigs.clickToEditTitle')}
                    onClick={() => setEditingName(true)}
                  >
                    {name}
                  </h1>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => setEditingName(true)}
                    aria-label={t('customConfigs.clickToEditTitle')}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              )}
              {/* 固定一行高度，避免切到「规则」tab 时徽章出现导致整块变高、右侧按钮上下漂移 */}
              <div className="flex min-h-6 flex-wrap items-center gap-1.5">
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

          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
            <Button variant="outline" size="sm" onClick={handleOpenPreview}>
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              {t('customConfigs.previewYaml')}
            </Button>
          </div>
        </div>
      </div>

      {/* ── 主体 Tabs（与 ?tab= 同步，刷新保留当前页） ── */}
      <Tabs value={activeTab} onValueChange={handleDetailTabChange}>
        <div className="overflow-x-auto pb-0.5">
          <TabsList className="h-9 gap-0.5 p-0.5">
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

        <div className="mt-3 rounded-lg border bg-muted/20 p-3">
          <div className="flex items-start gap-2">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-sm font-medium">{t('customConfigs.detailGuideTitle')}</p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t('customConfigs.detailGuideDescription')}
              </p>
            </div>
          </div>
        </div>

        {/* ── Tab 1: 代理节点 ── */}
        <TabsContent value="proxies" className="space-y-3 mt-3">
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
        <TabsContent value="proxyGroups" className="space-y-3 mt-3">
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
        <TabsContent value="rules" className="space-y-3 mt-2.5">
          <TooltipProvider delayDuration={300}>
          <div className="space-y-3">
            <div className="space-y-3">
              <div className="rounded-xl border bg-background p-3 shadow-sm">
                <div className="flex flex-col gap-2.5">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold leading-tight">
                        {t('customConfigs.rulesWorkspaceTitle')}
                      </h3>
                      <p className="mt-1 text-xs leading-snug text-muted-foreground">
                        {rulesTextMode
                          ? t('customConfigs.rulesWorkspaceTextHint')
                          : t('customConfigs.rulesWorkspaceStructuredHint')}
                      </p>
                    </div>
                    <div className="inline-flex shrink-0 rounded-lg border bg-muted/40 p-1">
                      <button
                        type="button"
                        className={cn(
                          'inline-flex h-8 min-w-[112px] items-center justify-center rounded-md px-3 text-sm font-medium transition-colors',
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
                          'inline-flex h-8 min-w-[112px] items-center justify-center rounded-md px-3 text-sm font-medium transition-colors',
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
                    <div className="grid gap-2 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button onClick={() => addRule('DOMAIN')} size="sm">
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          {t('customConfigs.addRule')}
                        </Button>
                        <div className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/20 px-1.5 py-0.5">
                          <span className="shrink-0 px-0.5 text-xs font-medium text-muted-foreground">
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
                          className="h-9 pl-9"
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
                    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border bg-muted/20 px-2 py-1.5">
                      <div className="flex items-center gap-1.5 px-0.5">
                        <ListFilter className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {t('customConfigs.ruleQuickFilter')}
                        </span>
                      </div>
                      <ToggleGroup
                        type="single"
                        value={ruleFilter}
                        onValueChange={(v) => setRuleFilter((v || 'all') as RuleFilterValue)}
                        variant="filter"
                        size="xs"
                        aria-label={t('customConfigs.ruleQuickFilter')}
                      >
                        {RULE_FILTER_OPTIONS.map((option) => (
                          <ToggleGroupItem key={option.value} value={option.value}>
                            {t(option.labelKey)}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                      {hasActiveFilters && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => {
                            setRuleSearch('')
                            setRuleFilter('all')
                            setShowOnlyIssues(false)
                          }}
                        >
                          {t('customConfigs.clearFilters')}
                        </Button>
                      )}
                      <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
                        {t('customConfigs.visibleRules', { count: visibleRuleCount, total: ruleStats.total })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <button
                  type="button"
                  className="rounded-lg border bg-muted/10 p-2.5 text-left transition-colors hover:bg-muted/20"
                  onClick={() => {
                    setRuleFilter('all')
                    setShowOnlyIssues(false)
                  }}
                >
                  <p className="text-xs text-muted-foreground">{t('customConfigs.ruleStatTotal')}</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">{ruleStats.total}</p>
                </button>
                <button
                  type="button"
                  className="rounded-lg border bg-muted/10 p-2.5 text-left transition-colors hover:bg-muted/20"
                  onClick={() => setRuleFilter('rule-set')}
                >
                  <p className="text-xs text-muted-foreground">{t('customConfigs.ruleStatRuleSets')}</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">{ruleStats.selectedRuleSets}</p>
                </button>
                <button
                  type="button"
                  className="rounded-lg border bg-muted/10 p-2.5 text-left transition-colors hover:bg-amber-50"
                  onClick={() => {
                    setShowOnlyIssues(true)
                    setRuleFilter('all')
                  }}
                >
                  <p className="text-xs text-muted-foreground">{t('customConfigs.ruleStatWarnings')}</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-amber-600 dark:text-amber-300">
                    {ruleStats.warnings}
                  </p>
                </button>
                <button
                  type="button"
                  className="rounded-lg border bg-muted/10 p-2.5 text-left transition-colors hover:bg-destructive/5"
                  onClick={() => {
                    setShowOnlyIssues(true)
                    setRuleFilter('all')
                  }}
                >
                  <p className="text-xs text-muted-foreground">{t('customConfigs.ruleStatErrors')}</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums text-destructive">{ruleStats.errors}</p>
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
                                <div className="flex items-center gap-2">
                                  <RuleStatusIndicator status={item.analysis.status} t={t} />
                                  <p className="min-w-0 flex-1 font-mono text-xs text-muted-foreground">
                                    L{item.lineNumber}: {item.analysis.rule}
                                  </p>
                                </div>
                                {item.analysis.errors.map((msg) => (
                                  <p key={`e-${msg.key}`} className="mt-2 text-xs text-destructive">
                                    {t(msg.key, msg.params)}
                                  </p>
                                ))}
                                {item.analysis.warnings.map((msg) => (
                                  <p
                                    key={`w-${msg.key}`}
                                    className="mt-2 text-xs text-amber-700 dark:text-amber-300"
                                  >
                                    {t(msg.key, msg.params)}
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
                      onDragCancel={(event) => {
                        lastRulesDragEndAtRef.current = Date.now()
                        const idStr = String(event.active.id)
                        const m = /^rule-(\d+)$/.exec(idStr)
                        lastDraggedRuleSourceIndexRef.current = m ? Number(m[1]) : null
                      }}
                    >
                      <SortableContext
                        items={filteredRuleListItems.map((item) => `rule-${item.sourceIndex}`)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2">
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
                              onToggle={toggleRuleRow}
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
                      <div className="flex items-center gap-2">
                        {activeRuleItem ? (
                          <RuleStatusIndicator status={activeRuleItem.analysis.status} t={t} />
                        ) : null}
                        <h5 className="text-sm font-semibold">{t('customConfigs.currentRuleCard')}</h5>
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
                          {activeRuleItem.analysis.errors.map((msg) => (
                            <p key={`active-e-${msg.key}`} className="text-xs text-destructive">{t(msg.key, msg.params)}</p>
                          ))}
                          {activeRuleItem.analysis.warnings.map((msg) => (
                            <p key={`active-w-${msg.key}`} className="text-xs text-amber-700 dark:text-amber-300">{t(msg.key, msg.params)}</p>
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
                                  {t(fix.labelKey)}
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
          </TooltipProvider>
        </TabsContent>

        {/* ── Tab 4: 规则集引用 ── */}
        <TabsContent value="ruleSets" className="space-y-3 mt-3">
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
