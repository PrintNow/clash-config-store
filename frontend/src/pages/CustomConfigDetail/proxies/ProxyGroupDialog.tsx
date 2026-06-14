import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import yaml from 'js-yaml'
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
import type { ProxyGroup } from '@/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select'
import { X, GripVertical, Code2, FormInput } from 'lucide-react'
import { sortableInstantReorder, BUILTIN_PROXIES } from '../shared/constants'

function groupToYaml(group: Partial<ProxyGroup> & { name: string; type: string }): string {
  return yaml.dump(group, { indent: 2, lineWidth: -1 })
}

function formToGroupObject(form: GroupFormState): Record<string, unknown> {
  const g: Record<string, unknown> = { name: form.name, type: form.type }
  if (form.proxies.length > 0) g.proxies = form.proxies
  if (form.useProviders.length > 0) g.use = form.useProviders
  if (form.type === 'url-test' || form.type === 'fallback' || form.type === 'load-balance') {
    g.url = form.url
    g.interval = parseInt(form.interval) || 300
    g.tolerance = parseInt(form.tolerance) || 50
  }
  if (form.type === 'load-balance') g.strategy = form.strategy
  return g
}

export interface ProviderItem {
  name: string
  type: 'http' | 'inline'
}

export interface ProxyGroupDialogProps {
  open: boolean
  initialGroup: ProxyGroup | null
  proxyNames: string[]    // 所有代理节点名称
  groupNames: string[]    // 其他代理组名称（排除自身）
  providerNames: string[] // 可供 use: 引用的订阅源名称（兼容旧接口）
  providerItems?: ProviderItem[] // 带类型信息的订阅源（优先使用）
  onClose: () => void
  onSave: (group: ProxyGroup) => void
}

const GROUP_TYPES: ProxyGroup['type'][] = [
  'select', 'url-test', 'fallback', 'load-balance', 'relay',
]

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
        className="hidden md:flex h-8 w-7 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:text-foreground active:cursor-grabbing"
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

export function ProxyGroupDialog({
  open, initialGroup, proxyNames, groupNames, providerNames, providerItems, onClose, onSave,
}: ProxyGroupDialogProps) {
  const resolvedProviderItems: ProviderItem[] = providerItems
    ?? providerNames.map((name) => ({ name, type: 'http' as const }))
  const { t } = useTranslation()
  const [form, setForm] = useState<GroupFormState>(defaultGroupForm)
  const [yamlMode, setYamlMode] = useState(false)
  const [yamlText, setYamlText] = useState('')
  const [yamlError, setYamlError] = useState('')

  useEffect(() => {
    if (open) {
      const f = initialGroup ? groupToForm(initialGroup) : defaultGroupForm
      setForm(f)
      setYamlMode(false)
      setYamlText('')
      setYamlError('')
    }
  }, [open, initialGroup])

  const switchToYaml = () => {
    setYamlText(groupToYaml(formToGroupObject(form) as Parameters<typeof groupToYaml>[0]))
    setYamlError('')
    setYamlMode(true)
  }

  const switchToForm = () => {
    try {
      const parsed = yaml.load(yamlText) as Record<string, unknown>
      if (!parsed || typeof parsed !== 'object') throw new Error('无效的 YAML')
      setForm(groupToForm(parsed as ProxyGroup))
      setYamlError('')
      setYamlMode(false)
    } catch (e) {
      setYamlError('YAML 解析失败: ' + (e as Error).message)
    }
  }

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
    if (yamlMode) {
      try {
        const parsed = yaml.load(yamlText) as Record<string, unknown>
        if (!parsed || typeof parsed !== 'object') throw new Error('无效的 YAML')
        if (!parsed.name || !parsed.type) throw new Error('缺少 name 或 type 字段')
        onSave(parsed as ProxyGroup)
      } catch (e) {
        setYamlError('YAML 解析失败: ' + (e as Error).message)
      }
      return
    }
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
      <DialogContent className="max-w-xl max-h-[95vh] overflow-y-auto sm:max-h-[85vh]">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            handleSave()
          }}
        >
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle>
                {initialGroup ? t('customConfigs.editProxyGroup') : t('customConfigs.addProxyGroup')}
              </DialogTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={yamlMode ? switchToForm : switchToYaml}
              >
                {yamlMode
                  ? <><FormInput className="h-3 w-3" /> 表单模式</>
                  : <><Code2 className="h-3 w-3" /> YAML 模式</>
                }
              </Button>
            </div>
          </DialogHeader>

          {yamlMode ? (
            <div className="space-y-2 py-2">
              {yamlError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {yamlError}
                </div>
              )}
              <Textarea
                value={yamlText}
                onChange={(e) => { setYamlText(e.target.value); setYamlError('') }}
                className="min-h-[320px] font-mono text-xs"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">直接编辑代理组 YAML，保存时自动解析。</p>
            </div>
          ) : (
          <div className="space-y-4 py-2">
            {/* 名称 */}
            <div className="space-y-1">
              <Label>{t('customConfigs.groupName')}</Label>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>

          {/* 类型 */}
          <div className="space-y-1">
            <Label>{t('customConfigs.groupType')}</Label>
            <NativeSelect
              value={form.type}
              onChange={(e) => set('type', e.target.value as ProxyGroup['type'])}
            >
              {GROUP_TYPES.map((gt) => (
                <NativeSelectOption key={gt} value={gt}>{gt}</NativeSelectOption>
              ))}
            </NativeSelect>
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
            {resolvedProviderItems.length === 0 ? (
              <p className="text-xs text-muted-foreground border rounded-md px-3 py-2">
                {t('subscriptions.noProviders')}
              </p>
            ) : (
              <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                {resolvedProviderItems.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <Checkbox
                      id={`use-${item.name}`}
                      checked={form.useProviders.includes(item.name)}
                      onCheckedChange={() => toggleProvider(item.name)}
                    />
                    <label htmlFor={`use-${item.name}`} className="text-sm cursor-pointer flex items-center gap-1.5">
                      {item.name}
                      {item.type === 'inline' && (
                        <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">(inline)</span>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">{t('customConfigs.groupUseHint')}</p>
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
              <NativeSelect value={form.strategy} onChange={(e) => set('strategy', e.target.value)}>
                {['consistent-hashing', 'round-robin', 'sticky-sessions'].map((s) => (
                  <NativeSelectOption key={s} value={s}>{s}</NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          )}
          </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit">{t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
