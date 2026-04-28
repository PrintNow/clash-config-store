import type { ProxyNode, ProxyGroup } from '@/types'
import { hasProxyOrGroupNameConflict } from '@/lib/rename-refs'

// ─────────────────────────────────────────────
// 工具函数：简单对象 <-> YAML 字符串互转
// ─────────────────────────────────────────────

/** 将代理节点对象序列化为简单 YAML 字符串 */
export function proxyToYaml(proxy: Record<string, unknown>): string {
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
export function yamlScalarForProxyName(val: string): string {
  if (/[:#{}[\]|>&*!,?]/.test(val) || val.includes('\n')) {
    return `"${val.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  }
  return val
}

/** 自定义节点：替换首处 name 行（支持 `- name:` / `name:`） */
export function replaceProxyYamlNameLine(rawYaml: string, newName: string): string {
  return rawYaml.replace(/^(\s*(?:-\s+)?name:\s*)(.+)$/m, (_, p1: string) => `${p1}${yamlScalarForProxyName(newName)}`)
}

/** 将简单 YAML 字符串解析为对象（仅支持扁平结构和一级数组） */
export function yamlToProxy(yaml: string): Record<string, unknown> {
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
// 代理节点协议类型
// ─────────────────────────────────────────────

export type ProxyProtocol =
  | 'ss' | 'vmess' | 'vless' | 'trojan' | 'hysteria2'
  | 'tuic' | 'wireguard' | 'http' | 'socks5' | 'custom'

export const PROXY_PROTOCOLS: ProxyProtocol[] = [
  'ss', 'vmess', 'vless', 'trojan', 'hysteria2',
  'tuic', 'wireguard', 'http', 'socks5', 'custom',
]

// 代理节点表单字段状态
export interface ProxyFormState {
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

export const defaultProxyForm: ProxyFormState = {
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
export function proxyNodeToForm(node: ProxyNode): ProxyFormState {
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
export function formToProxyNode(form: ProxyFormState): ProxyNode {
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
export function makeUniqueDuplicateProxyName(
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
export function buildDuplicatedProxyNode(proxy: ProxyNode, newName: string): ProxyNode {
  const form = proxyNodeToForm(proxy)
  form.name = newName
  if (form.type === 'custom' && form.rawYaml.trim()) {
    form.rawYaml = replaceProxyYamlNameLine(form.rawYaml, newName)
  }
  return formToProxyNode(form)
}
