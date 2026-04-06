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

// 自定义规则集
export interface CustomConfig {
  id: number
  user_id: number
  name: string
  proxies: string
  proxy_groups: string
  rules: string
}

// 输出订阅配置
export interface Subscription {
  id: number
  user_id: number
  name: string
  token: string
  token_expired_at?: string
  enabled_provider_ids: number[]
  custom_config_id?: number
  rule_insert_mode: 'prepend' | 'append' | 'replace'
  proxy_prefix_enabled: boolean
  base_config: string
  created_at: string
}

// 访问限制规则
export interface AccessRestriction {
  id: number
  subscription_id: number
  type: 'ip' | 'cidr' | 'country' | 'city'
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

// 仪表盘统计数据
export interface DashboardStats {
  total_providers: number
  total_subscriptions: number
  total_custom_configs: number
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
