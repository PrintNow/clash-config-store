---
name: mihomo-yaml-reference
description: Mihomo/Clash 配置文件 YAML 格式参考，包括 proxies、proxy-groups、rules、proxy-providers、rule-providers 的字段说明和示例。当修改 YAML 生成逻辑（internal/util/yaml.go）、处理订阅内容解析、或用户询问配置格式时使用。
---

# Mihomo YAML 配置参考

官方文档：https://github.com/MetaCubeX/Meta-Docs/tree/main/docs

---

## 完整配置结构

```yaml
# 基础设置
mixed-port: 7890
allow-lan: false
mode: rule          # rule / global / direct
log-level: info     # info / warning / error / debug / silent
external-controller: 127.0.0.1:9090

# DNS 配置（可选）
dns:
  enable: true
  listen: 0.0.0.0:53
  nameserver:
    - 8.8.8.8
    - tls://dns.alidns.com
  enhanced-mode: fake-ip

# 代理节点列表
proxies:
  - name: "香港01"
    type: ss
    server: hk.example.com
    port: 443
    cipher: chacha20-ietf-poly1305
    password: your-password

  - name: "美国01"
    type: vmess
    server: us.example.com
    port: 443
    uuid: your-uuid
    alterId: 0
    cipher: auto
    tls: true

  - name: "日本01"
    type: trojan
    server: jp.example.com
    port: 443
    password: your-password
    sni: jp.example.com

# 代理组
proxy-groups:
  - name: "Proxy"
    type: select           # select / url-test / fallback / load-balance / relay
    proxies:
      - "香港01"
      - "美国01"
      - DIRECT

  - name: "Auto"
    type: url-test
    proxies:
      - "香港01"
      - "美国01"
    url: https://www.gstatic.com/generate_204
    interval: 300

  - name: "Fallback"
    type: fallback
    proxies:
      - "香港01"
      - "美国01"
    url: https://www.gstatic.com/generate_204
    interval: 300

# 路由规则
rules:
  - DOMAIN-SUFFIX,google.com,Proxy
  - DOMAIN-KEYWORD,github,Proxy
  - GEOIP,CN,DIRECT
  - IP-CIDR,192.168.0.0/16,DIRECT,no-resolve
  - MATCH,Proxy
```

---

## Proxy Provider（订阅源方式）

```yaml
proxy-providers:
  provider1:
    type: http
    url: "https://example.com/sub"
    interval: 3600
    health-check:
      enable: true
      url: https://www.gstatic.com/generate_204
      interval: 300

proxy-groups:
  - name: "Proxy"
    type: select
    use:
      - provider1   # 引用 proxy-provider
    proxies:
      - DIRECT
```

---

## Rule Provider

```yaml
rule-providers:
  reject:
    type: http
    behavior: domain      # domain / ipcidr / classical
    url: "https://example.com/rules/reject.yaml"
    interval: 86400

rules:
  - RULE-SET,reject,REJECT
  - MATCH,DIRECT
```

---

## 本项目 YAML 生成逻辑

关键函数位置：`backend/internal/util/yaml.go`

| 函数 | 作用 |
|------|------|
| `ParseProxiesFromContent(content)` | 从上游订阅 YAML 中提取 `proxies:` 数组 |
| `PrefixProxies(proxies, name)` | 为节点名加前缀 `[ProviderName] ` |
| `ParseYAMLList(yamlText)` | 将 YAML 数组文本解析为 `[]interface{}` |
| `ParseRulesList(rulesText)` | 将规则文本解析为 `[]string` |
| `BuildMihomoConfig(...)` | 合并所有字段，生成最终 YAML |

`CustomConfig` 的三个 YAML 文本字段：
- `Proxies`：存储格式同 mihomo `proxies:` 数组（不含 key 本身）
- `ProxyGroups`：存储格式同 mihomo `proxy-groups:` 数组
- `Rules`：每行一条规则，或 YAML 字符串数组

`Subscription.BaseConfig`（JSON）示例：
```json
{
  "mixed-port": 7890,
  "allow-lan": false,
  "mode": "rule",
  "dns": { "enable": true, "nameserver": ["8.8.8.8"] }
}
```
