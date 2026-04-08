import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Trash2, Edit, Eye, Save, Pencil, Check, X, GripVertical } from 'lucide-react'
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
import { customConfigsApi } from '@/api/custom-configs'
import { ruleProvidersApi } from '@/api/rule-providers'
import { providersApi } from '@/api/providers'
import type { ProxyNode, ProxyGroup, RuleProvider } from '@/types'
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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

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

interface ParsedRule {
  type: string
  payload: string
  target: string
}

function parseRule(rule: string): ParsedRule {
  const parts = rule.split(',').map((s) => s.trim())
  if (parts[0] === 'MATCH') {
    return { type: 'MATCH', payload: '', target: parts[1] || '' }
  }
  return { type: parts[0] || '', payload: parts[1] || '', target: parts[2] || '' }
}

function ruleToString(r: ParsedRule): string {
  if (r.type === 'MATCH') return `MATCH,${r.target}`
  return `${r.type},${r.payload},${r.target}`
}

// ─────────────────────────────────────────────
// 可拖拽规则行组件
// ─────────────────────────────────────────────

interface SortableRuleRowProps {
  id: string
  rule: string
  idx: number
  allRuleProviders: RuleProvider[]
  proxyGroups: ProxyGroup[]
  proxies: ProxyNode[]
  onUpdate: (idx: number, field: keyof ParsedRule, value: string) => void
  onDelete: (idx: number) => void
  t: (key: string) => string
}

function SortableRuleRow({
  id, rule, idx, allRuleProviders, proxyGroups, proxies, onUpdate, onDelete, t,
}: SortableRuleRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, ...sortableInstantReorder })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const parsed = parseRule(rule)

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn('border-t', isDragging && 'relative z-10')}
    >
      {/* 拖拽把手 */}
      <td className="px-1 py-1 w-[28px]">
        <button
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-1 rounded"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      </td>
      {/* 规则类型 */}
      <td className="px-3 py-1">
        <Select value={parsed.type} onValueChange={(v) => onUpdate(idx, 'type', v)}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RULE_TYPES.map((rt) => (
              <SelectItem key={rt} value={rt}>{rt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      {/* 匹配内容 */}
      <td className="px-3 py-1">
        {parsed.type !== 'MATCH' && (
          parsed.type === 'RULE-SET' ? (
            <Select
              value={parsed.payload}
              onValueChange={(v) => onUpdate(idx, 'payload', v)}
            >
              <SelectTrigger className="h-7 text-xs">
                <SelectValue placeholder={t('customConfigs.selectRuleSets')} />
              </SelectTrigger>
              <SelectContent>
                {allRuleProviders.map((rp) => (
                  <SelectItem key={rp.id} value={rp.name}>{rp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              className="h-7 text-xs font-mono"
              value={parsed.payload}
              onChange={(e) => onUpdate(idx, 'payload', e.target.value)}
            />
          )
        )}
      </td>
      {/* 目标策略 */}
      <td className="px-3 py-1">
        <Select value={parsed.target} onValueChange={(v) => onUpdate(idx, 'target', v)}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="DIRECT / PROXY" />
          </SelectTrigger>
          <SelectContent>
            {BUILTIN_PROXIES.map((b) => (
              <SelectItem key={b} value={b}>{b}</SelectItem>
            ))}
            {proxyGroups.map((g) => (
              <SelectItem key={`group-${g.name}`} value={g.name}>{g.name}</SelectItem>
            ))}
            {proxies.map((p) => (
              <SelectItem key={`proxy-${p.name}`} value={p.name}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      {/* 删除 */}
      <td className="px-3 py-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => onDelete(idx)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
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
      className={cn('border-t hover:bg-muted/30', isDragging && 'relative z-10')}
    >
      <td className="px-1 py-2 w-[28px]">
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
      <td className="px-4 py-2">
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

// 规则类型可选项
const RULE_TYPES = [
  'DOMAIN', 'DOMAIN-SUFFIX', 'DOMAIN-KEYWORD', 'DOMAIN-REGEX',
  'IP-CIDR', 'IP-CIDR6', 'GEOIP', 'GEOSITE',
  'RULE-SET', 'PROCESS-NAME', 'MATCH',
]

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
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['aes-128-gcm', 'aes-256-gcm', 'chacha20-ietf-poly1305'].map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Password</Label>
            <Input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} />
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
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                <SelectTrigger><SelectValue /></SelectTrigger>
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
            <Input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} />
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
            <Input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} />
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
            <Input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} />
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
              <Input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} />
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
                <SelectTrigger><SelectValue /></SelectTrigger>
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
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleSave}>{t('common.save')}</Button>
        </DialogFooter>
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

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
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
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {GROUP_TYPES.map((gt) => (
                  <SelectItem key={gt} value={gt}>{gt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 成员节点 */}
          <div className="space-y-1">
            <Label>{t('customConfigs.groupProxies')}</Label>
            <div className="max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
              {allProxyOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground py-1">{t('common.noData')}</p>
              ) : (
                allProxyOptions.map((name) => (
                  <div key={name} className="flex items-center gap-2">
                    <Checkbox
                      id={`gp-${name}`}
                      checked={form.proxies.includes(name)}
                      onCheckedChange={() => toggleProxy(name)}
                    />
                    <label htmlFor={`gp-${name}`} className="text-sm cursor-pointer">{name}</label>
                  </div>
                ))
              )}
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
                <SelectTrigger><SelectValue /></SelectTrigger>
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
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleSave}>{t('common.save')}</Button>
        </DialogFooter>
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

  // YAML 预览面板
  const [previewOpen, setPreviewOpen] = useState(false)
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

  // 加载所有订阅源，供代理组"引用订阅源"选择
  const { data: allProviders = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: providersApi.list,
  })
  const providerNames = allProviders.map((p) => p.name)

  // 初始化表单
  useEffect(() => {
    if (config) {
      setName(config.name)
      setProxies(config.proxies || [])
      setProxyGroups(config.proxy_groups || [])
      setRules(config.rules || [])
      setRuleProviderIds(config.rule_provider_ids || [])
    }
  }, [config])

  // ── 保存 mutation ──
  const updateMutation = useMutation({
    mutationFn: (data: Parameters<typeof customConfigsApi.update>[1]) =>
      customConfigsApi.update(configId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-configs', configId] })
      queryClient.invalidateQueries({ queryKey: ['custom-configs'] })
      toast.success(t('customConfigs.saveSuccess'))
      setEditingName(false)
    },
    onError: () => toast.error(t('common.error')),
  })

  const handleSave = () => {
    // 若当前在文本模式，先同步规则
    const finalRules = rulesTextMode
      ? rulesText.split('\n').map((s) => s.trim()).filter(Boolean)
      : rules
    updateMutation.mutate({
      name,
      proxies,
      proxy_groups: proxyGroups,
      rules: finalRules,
      rule_provider_ids: ruleProviderIds,
    })
  }

  // ── YAML 预览 ──
  const handleOpenPreview = async () => {
    setPreviewOpen(true)
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
    if (editingProxyIndex >= 0) {
      setProxies((prev) => prev.map((p, i) => (i === editingProxyIndex ? node : p)))
    } else {
      setProxies((prev) => [...prev, node])
    }
    setProxyDialogOpen(false)
  }

  const handleDeleteProxy = (idx: number) => {
    setProxies((prev) => prev.filter((_, i) => i !== idx))
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
    if (editingGroupIndex >= 0) {
      setProxyGroups((prev) => prev.map((g, i) => (i === editingGroupIndex ? group : g)))
    } else {
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
    setRules((prev) => {
      const oldIndex = prev.findIndex((_, j) => `rule-${j}` === active.id)
      const newIndex = prev.findIndex((_, j) => `rule-${j}` === over.id)
      if (oldIndex < 0 || newIndex < 0) return prev
      return arrayMove(prev, oldIndex, newIndex)
    })
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
  const addRule = () => {
    setRules((prev) => [...prev, 'DOMAIN,example.com,DIRECT'])
  }

  const updateParsedRule = (idx: number, field: keyof ParsedRule, value: string) => {
    setRules((prev) => {
      const parsed = parseRule(prev[idx])
      parsed[field] = value
      return prev.map((r, i) => (i === idx ? ruleToString(parsed) : r))
    })
  }

  const deleteRule = (idx: number) => {
    setRules((prev) => prev.filter((_, i) => i !== idx))
  }

  // 切换到文本模式：把数组序列化为换行字符串
  const switchToTextMode = () => {
    setRulesText(rules.join('\n'))
    setRulesTextMode(true)
  }

  // 切换回表格模式：解析文本
  const switchToTableMode = () => {
    const parsed = rulesText.split('\n').map((s) => s.trim()).filter(Boolean)
    setRules(parsed)
    setRulesTextMode(false)
  }

  // ── 规则集操作 ──
  const toggleRuleProvider = (rpId: number) => {
    setRuleProviderIds((prev) =>
      prev.includes(rpId) ? prev.filter((id) => id !== rpId) : [...prev, rpId]
    )
  }

  // ── 加载/错误状态 ──
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!config) {
    return <div className="text-center py-16 text-muted-foreground">配置不存在</div>
  }

  // 所有代理节点名称（供代理组选择使用）
  const proxyNames = proxies.map((p) => p.name)

  return (
    <div className="space-y-6">
      {/* ── 顶部操作栏 ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/custom-configs')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>

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
              <Button size="icon" variant="ghost" onClick={() => handleSave()}>
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
              <h1 className="text-2xl font-bold">{name}</h1>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setEditingName(true)}
              >
                <Pencil className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleOpenPreview}>
            <Eye className="mr-2 h-4 w-4" />
            {t('customConfigs.previewYaml')}
          </Button>
          <Button onClick={handleSave} disabled={updateMutation.isPending}>
            <Save className="mr-2 h-4 w-4" />
            {updateMutation.isPending ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </div>

      {/* ── 主体 Tabs（与 ?tab= 同步，刷新保留当前页） ── */}
      <Tabs value={activeTab} onValueChange={handleDetailTabChange}>
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
            {ruleProviderIds.length > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">{ruleProviderIds.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

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
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">{t('customConfigs.proxyName')}</th>
                    <th className="text-left px-4 py-2 font-medium">{t('customConfigs.proxyType')}</th>
                    <th className="w-[100px] px-4 py-2 font-medium text-right">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {proxies.map((proxy, idx) => (
                    <tr key={idx} className="border-t hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2 font-medium">{proxy.name}</td>
                      <td className="px-4 py-2">
                        <Badge variant="secondary">{proxy.type}</Badge>
                      </td>
                      <td className="px-4 py-2 flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEditProxy(proxy, idx)}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteProxy(idx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
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
            <div className="border rounded-lg overflow-hidden">
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
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {!rulesTextMode && (
                <Button onClick={addRule} size="sm">
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  {t('customConfigs.addRule')}
                </Button>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={rulesTextMode ? switchToTableMode : switchToTextMode}
            >
              {rulesTextMode ? t('customConfigs.tableRulesMode') : t('customConfigs.rawRulesMode')}
            </Button>
          </div>

          {rulesTextMode ? (
            <Textarea
              className="font-mono text-sm min-h-[400px] resize-y"
              value={rulesText}
              onChange={(e) => setRulesText(e.target.value)}
              placeholder="DOMAIN,example.com,DIRECT&#10;GEOIP,CN,DIRECT&#10;MATCH,PROXY"
            />
          ) : rules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm border rounded-lg">
              {t('common.noData')}
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className={SORTABLE_TABLE_LAYOUT}>
                <thead className="bg-muted/50">
                  <tr>
                    <th className="w-[28px] px-1 py-2"></th>
                    <th className="text-left px-3 py-2 font-medium w-[180px]">{t('customConfigs.ruleType')}</th>
                    <th className="text-left px-3 py-2 font-medium">{t('customConfigs.rulePayload')}</th>
                    <th className="text-left px-3 py-2 font-medium w-[160px]">{t('customConfigs.ruleTarget')}</th>
                    <th className="w-[50px] px-3 py-2"></th>
                  </tr>
                </thead>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCorners}
                  onDragEnd={handleRulesDragEnd}
                >
                  <SortableContext
                    items={rules.map((_, i) => `rule-${i}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    <tbody>
                      {rules.map((rule, idx) => (
                        <SortableRuleRow
                          key={`rule-${idx}`}
                          id={`rule-${idx}`}
                          rule={rule}
                          idx={idx}
                          allRuleProviders={allRuleProviders}
                          proxyGroups={proxyGroups}
                          proxies={proxies}
                          onUpdate={updateParsedRule}
                          onDelete={deleteRule}
                          t={t}
                        />
                      ))}
                    </tbody>
                  </SortableContext>
                </DndContext>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Tab 4: 规则集引用 ── */}
        <TabsContent value="ruleSets" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{t('customConfigs.ruleSetHint')}</p>
            {allRuleProviders.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const allIds = allRuleProviders.map((rp) => rp.id)
                  const allSelected = allIds.every((id) => ruleProviderIds.includes(id))
                  setRuleProviderIds(allSelected ? [] : allIds)
                }}
              >
                {allRuleProviders.every((rp) => ruleProviderIds.includes(rp.id))
                  ? t('common.deselectAll')
                  : t('common.selectAll')}
              </Button>
            )}
          </div>

          {allRuleProviders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm border rounded-lg">
              {t('common.noData')}
            </div>
          ) : (
            <>
              {/* 内置预设分组 */}
              {allRuleProviders.some((rp) => rp.is_preset) && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    {t('ruleProviders.loyalsoldierSection')}
                  </h3>
                  <RuleProviderGroup
                    providers={allRuleProviders.filter((rp) => rp.is_preset)}
                    selectedIds={ruleProviderIds}
                    onToggle={toggleRuleProvider}
                  />
                </div>
              )}

              {/* 自定义规则集分组 */}
              {allRuleProviders.some((rp) => !rp.is_preset) && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">
                    {t('ruleProviders.customSection')}
                  </h3>
                  <RuleProviderGroup
                    providers={allRuleProviders.filter((rp) => !rp.is_preset)}
                    selectedIds={ruleProviderIds}
                    onToggle={toggleRuleProvider}
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
      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
        <SheetContent className="w-[600px] sm:w-[720px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t('customConfigs.previewYaml')}</SheetTitle>
          </SheetHeader>
          <div className="p-6 pt-4">
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
              <pre className="text-xs font-mono bg-muted rounded-lg p-4 overflow-auto whitespace-pre">
                {previewYaml}
              </pre>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ─────────────────────────────────────────────
// 辅助组件：规则集列表（带复选框）
// ─────────────────────────────────────────────

interface RuleProviderGroupProps {
  providers: RuleProvider[]
  selectedIds: number[]
  onToggle: (id: number) => void
}

function RuleProviderGroup({ providers, selectedIds, onToggle }: RuleProviderGroupProps) {
  const { t } = useTranslation()
  return (
    <div className="border rounded-lg overflow-hidden">
      {providers.map((rp, idx) => (
        <div
          key={rp.id}
          className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer ${idx !== 0 ? 'border-t' : ''}`}
          onClick={() => onToggle(rp.id)}
        >
          <Checkbox
            checked={selectedIds.includes(rp.id)}
            onCheckedChange={() => onToggle(rp.id)}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{rp.name}</span>
              {rp.is_preset && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  {t('ruleProviders.presetBadge')}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs px-1.5 py-0">{rp.behavior}</Badge>
            </div>
            {rp.url && (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{rp.url}</p>
            )}
          </div>
          {rp.interval > 0 && (
            <span className="text-xs text-muted-foreground shrink-0">{rp.interval}s</span>
          )}
        </div>
      ))}
    </div>
  )
}
