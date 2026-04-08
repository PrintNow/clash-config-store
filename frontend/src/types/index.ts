// 用户信息
export interface User {
  id: number
  email: string
  name: string
  created_at: string
}

// User-Agent 配置
export interface UserAgent {
  id: number
  user_id: number
  name: string
  value: string
  created_at: string
}

// 上游代理订阅源
export interface Provider {
  id: number
  user_id: number
  name: string
  url: string
  user_agent_id?: number
  cache_ttl: number
  last_fetched_at?: string
  fetch_error?: string
  user_agent?: UserAgent
}

// 代理节点（结构化）
// type="custom" 时包含 __raw__ 字段（原始 YAML 片段）
export interface ProxyNode {
  name: string
  type: string
  [key: string]: unknown
  __raw__?: string
}

// 代理组（结构化）
export interface ProxyGroup {
  name: string
  type: 'select' | 'url-test' | 'fallback' | 'load-balance' | 'relay'
  proxies?: string[]
  use?: string[]
  url?: string
  interval?: number
  tolerance?: number
  strategy?: string
  [key: string]: unknown
}

// 配置模板（可复用的顶层 mihomo 设置）
export interface ConfigTemplate {
  id: number
  user_id: number
  name: string
  description: string
  content: string
  created_at: string
  updated_at: string
}

// 规则集库条目
export interface RuleProvider {
  id: number
  user_id: number
  name: string
  type: 'http' | 'file'
  url: string
  behavior: 'domain' | 'ipcidr' | 'classical'
  format: 'yaml' | 'text' | 'mrs'
  interval: number
  is_preset: boolean
  preset_tag: string
  created_at: string
  updated_at: string
}

// 自定义配置（结构化）
export interface CustomConfig {
  id: number
  user_id: number
  name: string
  proxies: ProxyNode[]
  proxy_groups: ProxyGroup[]
  rules: string[]
  rule_provider_ids: number[]
  created_at: string
  updated_at: string
}

// 输出订阅配置
export interface Subscription {
  id: number
  user_id: number
  name: string
  token: string
  /** 后端根据 BASE_URL 拼好的对外订阅链接 */
  subscription_url?: string
  token_expired_at?: string
  enabled_provider_ids: number[]
  custom_config_id?: number
  config_template_id?: number
  rule_insert_mode: 'prepend' | 'append' | 'replace'
  proxy_prefix_enabled: boolean
  created_at: string
  custom_config?: CustomConfig
  config_template?: ConfigTemplate
}

// 访问限制规则
export interface AccessRestriction {
  id: number
  subscription_id: number
  type: 'ip' | 'cidr' | 'country'
  value: string
  mode: 'allow' | 'deny'
}

// 访问日志
export interface AccessLog {
  id: number
  subscription_id: number
  ip: string
  country: string
  country_code: string
  city: string
  allowed: boolean
  deny_reason?: string
  created_at: string
}

// Provider 缓存状态（仪表盘用）
export interface ProviderStatus {
  id: number
  name: string
  url: string
  last_fetched_at?: string
  fetch_error: string
  cache_stale: boolean
}

// 订阅健康状态（仪表盘用）
export interface SubscriptionHealth {
  id: number
  name: string
  subscription_url: string
  token_expired_at?: string
  token_expired: boolean
  days_until_expiry?: number
  has_custom_config: boolean
  has_config_template: boolean
}

// 仪表盘统计数据
export interface DashboardStats {
  total_providers: number
  total_subscriptions: number
  total_custom_configs: number
  total_config_templates: number
  total_rule_providers: number
  providers: ProviderStatus[]
  subscriptions: SubscriptionHealth[]
  recent_access_logs: AccessLog[]
}

// API 通用响应格式
export interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T
}

// 分页响应
export interface PagedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}
