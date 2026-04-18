/**
 * 基于浏览器原生 SubtleCrypto 的 RSA-OAEP 加密工具
 * 无需额外依赖，直接使用 Web Crypto API
 */

interface PublicKeyCache {
  cryptoKey: CryptoKey
  expiresAt: number // Unix 时间戳（秒）
}

// 模块级缓存，避免每次登录都重新获取
let publicKeyCache: PublicKeyCache | null = null

/**
 * 将 PEM 格式公钥解析为 CryptoKey
 */
async function importPublicKey(pem: string): Promise<CryptoKey> {
  // 去除 PEM 头尾和换行，得到 base64 字符串
  const b64 = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s+/g, '')

  const der = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

  return crypto.subtle.importKey(
    'spki',
    der,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  )
}

/**
 * 从服务端拉取公钥（内部方法，直接 fetch 避免循环依赖 axios client）
 */
async function fetchPublicKey(): Promise<PublicKeyCache> {
  const res = await fetch('/api/auth/public-key')
  if (!res.ok) {
    throw new Error('Failed to fetch public key')
  }
  const body = await res.json()
  const { public_key, expires_at } = body.data as { public_key: string; expires_at: number }

  const cryptoKey = await importPublicKey(public_key)
  return { cryptoKey, expiresAt: expires_at }
}

/**
 * 预加载并缓存公钥，供登录/注册页面在 mount 时调用
 * 若缓存有效（未过期）则直接返回，否则重新拉取
 */
export async function preloadPublicKey(): Promise<void> {
  const nowSec = Math.floor(Date.now() / 1000)
  if (publicKeyCache && publicKeyCache.expiresAt > nowSec + 60) {
    return // 缓存仍有效（留 60s 余量）
  }
  publicKeyCache = await fetchPublicKey()
}

/**
 * 用 RSA-OAEP(SHA-256) 加密密码，返回 base64 标准编码的密文
 * 若缓存已过期则自动重新拉取公钥
 */
export async function encryptPassword(password: string): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000)
  if (!publicKeyCache || publicKeyCache.expiresAt <= nowSec + 60) {
    publicKeyCache = await fetchPublicKey()
  }

  const encoded = new TextEncoder().encode(password)
  const encrypted = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    publicKeyCache.cryptoKey,
    encoded
  )

  // 转为 base64 标准编码，与后端 base64.StdEncoding 对应
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)))
}
