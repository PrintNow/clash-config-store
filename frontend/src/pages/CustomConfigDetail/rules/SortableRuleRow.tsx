import type { ParsedRule, RuleQuickFixAction } from '@/domain/rules'
import { RULE_TYPES, ruleSupportsNoResolve } from '@/domain/rules'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from '@/components/ui/native-select'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2 } from 'lucide-react'
import type { RuleListItem, RuleSetReferenceItem, RuleTargetOptionGroup } from '../shared/constants'
import { sortableInstantReorder } from '../shared/constants'
import { getRuleTypeMeta } from './RuleTypeMeta'
import { RuleStatusIndicator } from './RuleStatusIndicator'

export interface SortableRuleRowProps {
  id: string
  item: RuleListItem
  allRuleSets: RuleSetReferenceItem[]
  targetOptionGroups: RuleTargetOptionGroup[]
  onUpdate: (sourceIndex: number, field: keyof ParsedRule, value: string | boolean) => void
  onDelete: (sourceIndex: number) => void
  isActive: boolean
  /** 点击标题栏切换展开/收起 */
  onToggle: (sourceIndex: number) => void
  onFocus: (sourceIndex: number) => void
  onQuickFix: (sourceIndex: number, action: RuleQuickFixAction) => void
  t: (key: string, params?: Record<string, unknown>) => string
}

export function SortableRuleRow({
  id, item, allRuleSets, targetOptionGroups, onUpdate, onDelete, isActive, onToggle, onFocus, onQuickFix, t,
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
        : `${t(meta.hintKey)} · ${t('customConfigs.ruleTargetHint')}`

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group rounded-lg border bg-background transition-colors',
        analysis.status === 'valid' && 'border-border/70',
        !isActive && 'hover:bg-muted/50',
        // 展开时仅用边框区分当前行，避免整块底色与 hover 叠加显得脏
        isActive && 'border-primary/40 shadow-sm dark:border-primary/35',
        analysis.status === 'error' && 'border-destructive/40',
        analysis.status === 'warning' && 'border-amber-500/40',
        isDragging && 'relative z-10 shadow-md'
      )}
    >
      <div
        className="flex cursor-pointer items-center gap-1.5 border-b border-border/60 px-2 py-1.5"
        onClick={() => onToggle(sourceIndex)}
      >
        <div className="hidden md:flex items-center gap-1 self-stretch">
          <button
            type="button"
            className={cn(
              'flex h-8 w-7 items-center justify-center rounded text-muted-foreground transition-opacity hover:text-foreground cursor-grab active:cursor-grabbing',
              isActive ? 'opacity-100' : 'opacity-30 group-hover:opacity-100'
            )}
            onClick={(e) => e.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex shrink-0 items-center gap-1">
              <RuleStatusIndicator status={analysis.status} t={t} />
              <span className="text-[11px] font-medium leading-none text-muted-foreground">
                {lineNumber ? `L${lineNumber}` : `#${sourceIndex + 1}`}
              </span>
            </div>
            <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[11px] font-medium">
              {parsed.type || 'UNKNOWN'}
            </Badge>
            {!isActive && parsed.payload && (
              <span className="max-w-[240px] truncate rounded-full bg-muted px-1.5 py-0.5 font-mono text-[11px] leading-tight text-muted-foreground">
                {parsed.payload}
              </span>
            )}
            {!isActive && parsed.target && (
              <span className="max-w-[220px] truncate rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium leading-tight text-foreground/80">
                {parsed.target}
              </span>
            )}
            {!isActive && parsed.noResolve && (
              <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px] font-normal text-muted-foreground">
                no-resolve
              </Badge>
            )}
          </div>
          </div>
          <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation()
            onDelete(sourceIndex)
          }}
          >
          <Trash2 className="h-3.5 w-3.5" />
          </Button>
          </div>

          {isActive && (
          <div className="space-y-1.5 px-2 pb-1.5 pt-1">
          <div className="grid gap-x-2 gap-y-1.5 lg:grid-cols-[200px_minmax(180px,1fr)_minmax(160px,1fr)] lg:items-start">

            <div className="space-y-0.5 min-w-0">
              <Label className="text-[11px] leading-tight text-muted-foreground">{t('customConfigs.ruleType')}</Label>
              <NativeSelect
                value={parsed.type}
                onChange={(e) => onUpdate(sourceIndex, 'type', e.target.value)}
                onFocus={() => onFocus(sourceIndex)}
                className="h-8 pr-5 text-[13px]"
              >
                {!RULE_TYPES.includes(parsed.type as (typeof RULE_TYPES)[number]) && parsed.type && (
                  <NativeSelectOption value={parsed.type}>{parsed.type}</NativeSelectOption>
                )}
                {RULE_TYPES.map((rt) => (
                  <NativeSelectOption key={rt} value={rt}>{rt}</NativeSelectOption>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-0.5">
              <Label className="text-[11px] leading-tight text-muted-foreground">
                {parsed.type === 'MATCH'
                  ? t('customConfigs.rulePayloadNotRequired')
                  : meta.payloadLabel || t('customConfigs.rulePayload')}
              </Label>
              {parsed.type === 'MATCH' ? (
                <div className="flex h-8 items-center rounded-md border border-input bg-muted/40 px-2 text-[13px] text-muted-foreground">
                  {t('customConfigs.matchRuleCompactHint')}
                </div>
              ) : parsed.type === 'RULE-SET' ? (
                <NativeSelect
                  value={parsed.payload}
                  onChange={(e) => onUpdate(sourceIndex, 'payload', e.target.value)}
                  onFocus={() => onFocus(sourceIndex)}
                  className={cn(
                    'h-8 text-[13px]',
                    !ruleProviderExists && parsed.payload && 'border-destructive text-destructive',
                    ruleProviderExists && analysis.warnings.some((msg) => msg.key === 'customConfigs.ruleAnalysis.ruleSetNotSelected') && 'border-amber-500'
                  )}
                >
                  <NativeSelectOption value="">{t('customConfigs.selectRuleSets')}</NativeSelectOption>
                  {currentRuleProvider && (
                    <NativeSelectOption value={currentRuleProvider}>{currentRuleProvider}</NativeSelectOption>
                  )}
                  {allRuleSets.some((rp) => rp.source === 'preset') && (
                    <NativeSelectOptGroup label={t('ruleProviders.loyalsoldierSection')}>
                      {allRuleSets.filter((rp) => rp.source === 'preset').map((rp) => (
                        <NativeSelectOption key={rp.id} value={rp.name}>{rp.name}</NativeSelectOption>
                      ))}
                    </NativeSelectOptGroup>
                  )}
                  {allRuleSets.some((rp) => rp.source === 'external') && (
                    <NativeSelectOptGroup label={t('ruleProviders.customSection')}>
                      {allRuleSets.filter((rp) => rp.source === 'external').map((rp) => (
                        <NativeSelectOption key={rp.id} value={rp.name}>{rp.name}</NativeSelectOption>
                      ))}
                    </NativeSelectOptGroup>
                  )}
                  {allRuleSets.some((rp) => rp.source === 'hosted') && (
                    <NativeSelectOptGroup label={t('hostedRuleSets.customSection')}>
                      {allRuleSets.filter((rp) => rp.source === 'hosted').map((rp) => (
                        <NativeSelectOption key={`hosted-${rp.id}`} value={rp.name}>{rp.name}</NativeSelectOption>
                      ))}
                    </NativeSelectOptGroup>
                  )}
                </NativeSelect>
              ) : (
                <Input
                  className="h-8 font-mono text-[13px]"
                  value={parsed.payload}
                  onFocus={() => onFocus(sourceIndex)}
                  onChange={(e) => onUpdate(sourceIndex, 'payload', e.target.value)}
                  placeholder={meta.payloadPlaceholder}
                />
              )}
            </div>

            <div className="space-y-0.5">
              <Label className="text-[11px] leading-tight text-muted-foreground">{t('customConfigs.ruleTarget')}</Label>
              <NativeSelect
                value={parsed.target}
                onChange={(e) => onUpdate(sourceIndex, 'target', e.target.value)}
                onFocus={() => onFocus(sourceIndex)}
                aria-invalid={!targetExists && !!parsed.target}
                className={cn(
                  'h-8 text-[13px]',
                  !targetExists && parsed.target && 'border-destructive text-destructive'
                )}
              >
                <NativeSelectOption value="">DIRECT / PROXY</NativeSelectOption>
                {currentTarget && (
                  <NativeSelectOption value={currentTarget}>{currentTarget}</NativeSelectOption>
                )}
                {targetOptionGroups.map((group) => (
                  group.values.length > 0 && (
                    <NativeSelectOptGroup key={group.key} label={group.label}>
                      {group.values.map((value) => (
                        <NativeSelectOption key={`${group.key}-${value}`} value={value}>
                          {value}
                        </NativeSelectOption>
                      ))}
                    </NativeSelectOptGroup>
                  )
                ))}
              </NativeSelect>
            </div>
          </div>

          {parsed.type !== 'MATCH' && ruleSupportsNoResolve(parsed.type) && (
            <div className="flex w-full gap-2.5 rounded-md border border-border/60 bg-muted/10 px-2 py-1.5">
              <Checkbox
                id={`rule-nr-${sourceIndex}`}
                className="shrink-0 translate-y-px"
                checked={!!parsed.noResolve}
                onCheckedChange={(v) => onUpdate(sourceIndex, 'noResolve', v === true)}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="min-w-0 flex-1 space-y-1">
                <Label
                  htmlFor={`rule-nr-${sourceIndex}`}
                  className="block cursor-pointer text-[12px] font-medium leading-tight"
                >
                  {t('customConfigs.ruleNoResolve')}
                </Label>
                <p className="text-[11px] leading-snug text-muted-foreground">
                  {parsed.type === 'RULE-SET'
                    ? t('customConfigs.ruleNoResolveHintRuleSet')
                    : t('customConfigs.ruleNoResolveHint')}
                </p>
              </div>
            </div>
          )}

          {parsed.type === 'MATCH' && analysis.quickFixes.some((fix) => fix.type === 'move-match-to-bottom') && (
            <div className="rounded-md border border-amber-500/40 bg-amber-50 px-2 py-1.5 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
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
            <div className="rounded-md bg-muted/20 px-2 py-1.5 text-[11px] leading-snug">
              <div className="space-y-0.5">
                {analysis.errors.map((msg) => (
                  <p key={`e-${msg.key}`} className="text-destructive">{t(msg.key, msg.params)}</p>
                ))}
                {analysis.warnings.map((msg) => (
                  <p
                    key={`w-${msg.key}`}
                    className="text-amber-700 dark:text-amber-300"
                  >
                    {t(msg.key, msg.params)}
                  </p>
                ))}
                {showHelp && analysis.errors.length === 0 && analysis.warnings.length === 0 && (
                  <p className="text-muted-foreground">{helpMessage}</p>
                )}
              </div>
              {analysis.quickFixes.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
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
                      {t(fix.labelKey)}
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
