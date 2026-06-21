import { useState, useEffect } from 'react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight } from 'lucide-react'

const PROTOCOLS = ['ss', 'vmess', 'vless', 'trojan', 'hysteria2', 'tuic', 'http', 'socks5'] as const
type Protocol = typeof PROTOCOLS[number]

const TLS_PROTOCOLS: Protocol[] = ['vmess', 'vless', 'trojan', 'hysteria2', 'tuic', 'http', 'socks5']

interface ProxyNodeFormProps {
  initialValue?: Record<string, unknown>
  onSave: (node: Record<string, unknown>) => void
  onCancel: () => void
}

interface FormState {
  name: string
  type: Protocol
  server: string
  port: string
  // ss
  cipher: string
  password: string
  plugin: string
  udp: boolean
  // vmess
  uuid: string
  alterId: string
  vmessCipher: string
  network: string
  wsPath: string
  wsHost: string
  // vless
  flow: string
  // trojan
  trojanPassword: string
  // hysteria2
  hysteria2Password: string
  obfs: string
  up: string
  down: string
  // tuic
  tuicUuid: string
  tuicPassword: string
  // http/socks5 auth
  username: string
  httpPassword: string
  // TLS common
  tls: boolean
  sni: string
  skipCertVerify: boolean
  fingerprint: string
  alpn: string
}

const defaultForm: FormState = {
  name: '',
  type: 'ss',
  server: '',
  port: '',
  cipher: 'aes-256-gcm',
  password: '',
  plugin: '',
  udp: false,
  uuid: '',
  alterId: '0',
  vmessCipher: 'auto',
  network: 'tcp',
  wsPath: '/',
  wsHost: '',
  flow: '',
  trojanPassword: '',
  hysteria2Password: '',
  obfs: '',
  up: '',
  down: '',
  tuicUuid: '',
  tuicPassword: '',
  username: '',
  httpPassword: '',
  tls: false,
  sni: '',
  skipCertVerify: false,
  fingerprint: '',
  alpn: '',
}

function nodeToForm(node: Record<string, unknown>): FormState {
  const type = (String(node.type ?? 'ss')) as Protocol
  return {
    ...defaultForm,
    name: String(node.name ?? ''),
    type,
    server: String(node.server ?? ''),
    port: String(node.port ?? ''),
    cipher: String(node.cipher ?? 'aes-256-gcm'),
    password: String(node.password ?? ''),
    plugin: String(node.plugin ?? ''),
    udp: Boolean(node.udp),
    uuid: String(node.uuid ?? ''),
    alterId: String(node['alterId'] ?? '0'),
    vmessCipher: String(node.cipher ?? 'auto'),
    network: String(node.network ?? 'tcp'),
    wsPath: String((node['ws-opts'] as Record<string, unknown>)?.path ?? '/'),
    wsHost: String(((node['ws-opts'] as Record<string, unknown>)?.headers as Record<string, unknown>)?.Host ?? ''),
    flow: String(node.flow ?? ''),
    trojanPassword: type === 'trojan' ? String(node.password ?? '') : '',
    hysteria2Password: type === 'hysteria2' ? String(node.password ?? '') : '',
    obfs: String((node.obfs as Record<string, unknown>)?.type ?? ''),
    up: String(node.up ?? ''),
    down: String(node.down ?? ''),
    tuicUuid: type === 'tuic' ? String(node.uuid ?? '') : '',
    tuicPassword: type === 'tuic' ? String(node.password ?? '') : '',
    username: String(node.username ?? ''),
    httpPassword: (type === 'http' || type === 'socks5') ? String(node.password ?? '') : '',
    tls: Boolean(node.tls),
    sni: String(node.sni ?? ''),
    skipCertVerify: Boolean(node['skip-cert-verify']),
    fingerprint: String(node.fingerprint ?? ''),
    alpn: Array.isArray(node.alpn) ? (node.alpn as string[]).join(',') : '',
  }
}

function formToNode(form: FormState): Record<string, unknown> {
  const base: Record<string, unknown> = {
    name: form.name.trim(),
    type: form.type,
    server: form.server.trim(),
    port: Number(form.port) || 0,
  }

  if (form.type === 'ss') {
    base.cipher = form.cipher
    base.password = form.password
    if (form.plugin) base.plugin = form.plugin
    if (form.udp) base.udp = true
  }

  if (form.type === 'vmess') {
    base.uuid = form.uuid
    base['alterId'] = Number(form.alterId) || 0
    base.cipher = form.vmessCipher
    base.network = form.network
    if (form.network === 'ws') {
      base['ws-opts'] = {
        path: form.wsPath || '/',
        headers: form.wsHost ? { Host: form.wsHost } : undefined,
      }
    }
  }

  if (form.type === 'vless') {
    base.uuid = form.uuid
    if (form.flow) base.flow = form.flow
    if (form.network) base.network = form.network
  }

  if (form.type === 'trojan') {
    base.password = form.trojanPassword
    if (form.network) base.network = form.network
  }

  if (form.type === 'hysteria2') {
    base.password = form.hysteria2Password
    if (form.obfs) base.obfs = { type: form.obfs }
    if (form.up) base.up = form.up
    if (form.down) base.down = form.down
  }

  if (form.type === 'tuic') {
    base.uuid = form.tuicUuid
    base.password = form.tuicPassword
  }

  if (form.type === 'http' || form.type === 'socks5') {
    if (form.username) base.username = form.username
    if (form.httpPassword) base.password = form.httpPassword
  }

  // TLS
  if (TLS_PROTOCOLS.includes(form.type) && form.type !== 'ss') {
    if (form.tls) base.tls = true
    if (form.sni) base.sni = form.sni
    if (form.skipCertVerify) base['skip-cert-verify'] = true
    if (form.fingerprint) base.fingerprint = form.fingerprint
    if (form.alpn) base.alpn = form.alpn.split(',').map((s) => s.trim()).filter(Boolean)
  }

  return base
}

export function ProxyNodeForm({ initialValue, onSave, onCancel }: ProxyNodeFormProps) {
  const [form, setForm] = useState<FormState>(defaultForm)
  const [rawYamlOpen, setRawYamlOpen] = useState(false)
  const [rawYaml, setRawYaml] = useState('')

  useEffect(() => {
    if (initialValue) {
      setForm(nodeToForm(initialValue))
    } else {
      setForm(defaultForm)
    }
  }, [initialValue])

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }))

  const handleParseRawYaml = () => {
    try {
      // 简单解析 YAML key: value 格式
      const obj: Record<string, unknown> = {}
      rawYaml.split('\n').forEach((line) => {
        const m = /^([^:]+):\s*(.*)$/.exec(line.trim())
        if (m) {
          const k = m[1].trim()
          const v = m[2].trim()
          if (v === 'true') obj[k] = true
          else if (v === 'false') obj[k] = false
          else if (!isNaN(Number(v)) && v !== '') obj[k] = Number(v)
          else obj[k] = v
        }
      })
      if (obj.name || obj.type || obj.server) {
        setForm(nodeToForm(obj))
        setRawYamlOpen(false)
        setRawYaml('')
      }
    } catch {
      // silently ignore parse errors
    }
  }

  const handleSubmit = () => {
    if (!form.name.trim() || !form.server.trim() || !form.port) return
    onSave(formToNode(form))
  }

  const showTls = TLS_PROTOCOLS.includes(form.type) && form.type !== 'ss'

  return (
    <div className="space-y-4 py-2">
      {/* 通用字段 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 space-y-1">
          <Label>名称</Label>
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="节点名称" />
        </div>
        <div className="space-y-1">
          <Label>协议</Label>
          <NativeSelect value={form.type} onChange={(e) => set('type', e.target.value as Protocol)}>
            {PROTOCOLS.map((p) => (
              <NativeSelectOption key={p} value={p}>{p}</NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="space-y-1">
          <Label>服务器</Label>
          <Input value={form.server} onChange={(e) => set('server', e.target.value)} placeholder="hostname or IP" />
        </div>
        <div className="space-y-1">
          <Label>端口</Label>
          <Input type="number" value={form.port} onChange={(e) => set('port', e.target.value)} placeholder="443" />
        </div>
      </div>

      {/* ss */}
      {form.type === 'ss' && (
        <div className="space-y-3 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">Shadowsocks 设置</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Cipher</Label>
              <NativeSelect value={form.cipher} onChange={(e) => set('cipher', e.target.value)}>
                {['aes-256-gcm', 'aes-128-gcm', 'chacha20-ietf-poly1305', 'xchacha20-ietf-poly1305'].map((c) => (
                  <NativeSelectOption key={c} value={c}>{c}</NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1">
              <Label>Password</Label>
              <Input value={form.password} onChange={(e) => set('password', e.target.value)} type="password" />
            </div>
            <div className="space-y-1">
              <Label>Plugin (可选)</Label>
              <Input value={form.plugin} onChange={(e) => set('plugin', e.target.value)} placeholder="obfs-local" />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox checked={form.udp} onCheckedChange={(v) => set('udp', Boolean(v))} id="ss-udp" />
              <label htmlFor="ss-udp" className="text-sm cursor-pointer">UDP</label>
            </div>
          </div>
        </div>
      )}

      {/* vmess */}
      {form.type === 'vmess' && (
        <div className="space-y-3 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">VMess 设置</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>UUID</Label>
              <Input value={form.uuid} onChange={(e) => set('uuid', e.target.value)} placeholder="uuid" />
            </div>
            <div className="space-y-1">
              <Label>AlterId</Label>
              <Input type="number" value={form.alterId} onChange={(e) => set('alterId', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Cipher</Label>
              <NativeSelect value={form.vmessCipher} onChange={(e) => set('vmessCipher', e.target.value)}>
                {['auto', 'aes-128-gcm', 'chacha20-poly1305', 'none'].map((c) => (
                  <NativeSelectOption key={c} value={c}>{c}</NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1">
              <Label>Network</Label>
              <NativeSelect value={form.network} onChange={(e) => set('network', e.target.value)}>
                {['tcp', 'ws', 'grpc', 'h2'].map((n) => (
                  <NativeSelectOption key={n} value={n}>{n}</NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            {form.network === 'ws' && (
              <>
                <div className="space-y-1">
                  <Label>WS Path</Label>
                  <Input value={form.wsPath} onChange={(e) => set('wsPath', e.target.value)} placeholder="/" />
                </div>
                <div className="space-y-1">
                  <Label>WS Host (可选)</Label>
                  <Input value={form.wsHost} onChange={(e) => set('wsHost', e.target.value)} placeholder="example.com" />
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* vless */}
      {form.type === 'vless' && (
        <div className="space-y-3 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">VLESS 设置</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>UUID</Label>
              <Input value={form.uuid} onChange={(e) => set('uuid', e.target.value)} placeholder="uuid" />
            </div>
            <div className="space-y-1">
              <Label>Flow (可选)</Label>
              <Input value={form.flow} onChange={(e) => set('flow', e.target.value)} placeholder="xtls-rprx-vision" />
            </div>
            <div className="space-y-1">
              <Label>Network</Label>
              <NativeSelect value={form.network} onChange={(e) => set('network', e.target.value)}>
                {['tcp', 'ws', 'grpc', 'h2'].map((n) => (
                  <NativeSelectOption key={n} value={n}>{n}</NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>
        </div>
      )}

      {/* trojan */}
      {form.type === 'trojan' && (
        <div className="space-y-3 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">Trojan 设置</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Password</Label>
              <Input value={form.trojanPassword} onChange={(e) => set('trojanPassword', e.target.value)} type="password" />
            </div>
            <div className="space-y-1">
              <Label>Network</Label>
              <NativeSelect value={form.network} onChange={(e) => set('network', e.target.value)}>
                {['tcp', 'ws', 'grpc'].map((n) => (
                  <NativeSelectOption key={n} value={n}>{n}</NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>
        </div>
      )}

      {/* hysteria2 */}
      {form.type === 'hysteria2' && (
        <div className="space-y-3 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">Hysteria2 设置</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>Password</Label>
              <Input value={form.hysteria2Password} onChange={(e) => set('hysteria2Password', e.target.value)} type="password" />
            </div>
            <div className="space-y-1">
              <Label>Obfs (可选)</Label>
              <Input value={form.obfs} onChange={(e) => set('obfs', e.target.value)} placeholder="salamander" />
            </div>
            <div className="space-y-1">
              <Label>Up (Mbps, 可选)</Label>
              <Input value={form.up} onChange={(e) => set('up', e.target.value)} placeholder="100" />
            </div>
            <div className="space-y-1">
              <Label>Down (Mbps, 可选)</Label>
              <Input value={form.down} onChange={(e) => set('down', e.target.value)} placeholder="100" />
            </div>
          </div>
        </div>
      )}

      {/* tuic */}
      {form.type === 'tuic' && (
        <div className="space-y-3 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">TUIC 设置</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1">
              <Label>UUID</Label>
              <Input value={form.tuicUuid} onChange={(e) => set('tuicUuid', e.target.value)} placeholder="uuid" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Password</Label>
              <Input value={form.tuicPassword} onChange={(e) => set('tuicPassword', e.target.value)} type="password" />
            </div>
          </div>
        </div>
      )}

      {/* http / socks5 */}
      {(form.type === 'http' || form.type === 'socks5') && (
        <div className="space-y-3 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">认证（可选）</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Username</Label>
              <Input value={form.username} onChange={(e) => set('username', e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Password</Label>
              <Input value={form.httpPassword} onChange={(e) => set('httpPassword', e.target.value)} type="password" />
            </div>
          </div>
        </div>
      )}

      {/* TLS */}
      {showTls && (
        <div className="space-y-3 border-t pt-3">
          <div className="flex items-center gap-2">
            <Checkbox checked={form.tls} onCheckedChange={(v) => set('tls', Boolean(v))} id="tls-enable" />
            <label htmlFor="tls-enable" className="text-sm font-medium cursor-pointer">启用 TLS</label>
          </div>
          {form.tls && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>SNI (可选)</Label>
                <Input value={form.sni} onChange={(e) => set('sni', e.target.value)} placeholder="example.com" />
              </div>
              <div className="space-y-1">
                <Label>Fingerprint (可选)</Label>
                <Input value={form.fingerprint} onChange={(e) => set('fingerprint', e.target.value)} placeholder="chrome" />
              </div>
              <div className="space-y-1">
                <Label>ALPN (逗号分隔, 可选)</Label>
                <Input value={form.alpn} onChange={(e) => set('alpn', e.target.value)} placeholder="h2,http/1.1" />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Checkbox checked={form.skipCertVerify} onCheckedChange={(v) => set('skipCertVerify', Boolean(v))} id="skip-cert" />
                <label htmlFor="skip-cert" className="text-sm cursor-pointer">Skip Cert Verify</label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 粘贴原始 YAML */}
      <div className="border-t pt-3">
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setRawYamlOpen(!rawYamlOpen)}
        >
          {rawYamlOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          粘贴原始 YAML 快速填入
        </button>
        {rawYamlOpen && (
          <div className="mt-2 space-y-2">
            <Textarea
              value={rawYaml}
              onChange={(e) => setRawYaml(e.target.value)}
              placeholder={'name: My Proxy\ntype: ss\nserver: example.com\nport: 443\n...'}
              className="min-h-[120px] font-mono text-xs"
            />
            <Button type="button" variant="outline" size="sm" onClick={handleParseRawYaml}>
              解析并填入表单
            </Button>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>取消</Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!form.name.trim() || !form.server.trim() || !form.port}
        >
          保存
        </Button>
      </div>
    </div>
  )
}
