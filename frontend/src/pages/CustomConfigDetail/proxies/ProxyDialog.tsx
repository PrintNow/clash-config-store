import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { ProxyNode } from '@/types'
import { ProxyPasswordInput } from '@/components/ProxyPasswordInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  type ProxyFormState,
  type ProxyProtocol,
  PROXY_PROTOCOLS,
  defaultProxyForm,
  proxyNodeToForm,
  formToProxyNode,
  proxyToYaml,
  yamlToProxy,
} from './proxy-form'

// ─────────────────────────────────────────────
// 内部组件：代理节点编辑弹窗
// ─────────────────────────────────────────────

export interface ProxyDialogProps {
  open: boolean
  initialNode: ProxyNode | null  // null = 新建
  dialerProxyNames: string[]     // 可选的 dialer-proxy 目标名称列表（代理节点/组）
  onClose: () => void
  onSave: (node: ProxyNode) => void
}

export function ProxyDialog({ open, initialNode, dialerProxyNames, onClose, onSave }: ProxyDialogProps) {
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
            <NativeSelect value={form.cipher} onChange={(e) => set('cipher', e.target.value)}>
              {['aes-128-gcm', 'aes-256-gcm', 'chacha20-ietf-poly1305'].map((c) => (
                <NativeSelectOption key={c} value={c}>{c}</NativeSelectOption>
              ))}
            </NativeSelect>
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
              <NativeSelect value={form.cipher} onChange={(e) => set('cipher', e.target.value)}>
                {['auto', 'aes-128-gcm', 'chacha20-poly1305', 'none'].map((c) => (
                  <NativeSelectOption key={c} value={c}>{c}</NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Network</Label>
              <NativeSelect value={form.network} onChange={(e) => set('network', e.target.value)}>
                {['tcp', 'ws', 'http', 'h2', 'grpc'].map((n) => (
                  <NativeSelectOption key={n} value={n}>{n}</NativeSelectOption>
                ))}
              </NativeSelect>
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
              <NativeSelect value={form.network} onChange={(e) => set('network', e.target.value)}>
                {['tcp', 'ws', 'http', 'grpc'].map((n) => (
                  <NativeSelectOption key={n} value={n}>{n}</NativeSelectOption>
                ))}
              </NativeSelect>
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
              <NativeSelect
                value={form.type}
                onChange={(e) => {
                  const v = e.target.value as ProxyProtocol
                  set('type', v)
                  if (v === 'custom') setYamlMode(true)
                }}
              >
                {PROXY_PROTOCOLS.map((p) => (
                  <NativeSelectOption key={p} value={p}>{p}</NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          )}

          {/* dialer-proxy（代理链）- 让当前节点通过其他节点连接 */}
          {!yamlMode && dialerProxyNames.length > 0 && (
            <div className="space-y-1">
              <Label>{t('customConfigs.dialerProxy')} <span className="text-xs text-muted-foreground">({t('common.optional')})</span></Label>
              <NativeSelect
                value={form.dialerProxy}
                onChange={(e) => set('dialerProxy', e.target.value)}
              >
                <NativeSelectOption value="">{t('customConfigs.dialerProxyNone')}</NativeSelectOption>
                {dialerProxyNames.map((name) => (
                  <NativeSelectOption key={name} value={name}>{name}</NativeSelectOption>
                ))}
              </NativeSelect>
              <p className="text-xs text-muted-foreground">{t('customConfigs.dialerProxyNodeHint')}</p>
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
