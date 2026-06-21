# Clash Config Store — 前端重设计实施规格

> 本文档供 coding agent 使用。  
> 视觉原型：`prototype.html`（可在浏览器直接打开预览）  
> 设计决策说明：`ux-design-doc.md`

---

## 0. 技术栈

- **前端**：React + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **后端**：Go 1.25 + Gin + GORM + SQLite/MySQL
- **参考原型**：`prototype.html`（单文件，浏览器打开即可交互）

---

## 1. 导航结构变更

### 1.1 新侧边栏结构

文件：`frontend/src/components/layout/Sidebar.tsx`

```
概览          /
─────────────── [来源素材]
节点源        /providers
规则集        /rule-sets          ← 原"规则集库"+"托管规则集"合并
─────────────── [配置编排]
自定义配置    /configs
配置模板      /templates
─────────────── [发布]
订阅管理      /subscriptions
───────────────
UA 库         /ua-library
设置          /settings
```

### 1.2 删除的路由

- `/rule-providers`（规则集库）
- `/hosted-rule-sets`（托管规则集）

两者合并为 `/rule-sets`，用 tab 区分。

### 1.3 侧边栏底部流程提示

在导航底部（设置之下）渲染一个小卡片，静态文案：

```
节点源 → proxy-providers
规则集 → rule-providers
↓
自定义配置组装
↓
订阅链接下发
```

---

## 2. 页面变更详情

### 2.1 节点源（`/providers`）

**变更：新增 `inline` 类型支持**

#### 列表页

- 卡片展示三个字段：类型徽标（`http` 蓝色 / `inline` 紫色）、节点数、状态
- `inline` 类型卡片：
  - 不显示 URL，改为显示节点名称 tag 列表（最多展示 3 个，超出显示 +N）
  - 无"刷新"按钮，改为"✏️ 编辑节点"按钮
  - 展开详情时显示节点明细表格

#### 添加节点源弹窗

两种类型卡片式选择（**删除原有的 file 类型**）：

| 类型 | 说明 |
|------|------|
| `http` | 远端订阅 URL，机场订阅 |
| `inline` | 私有节点，手动填写，存入数据库 |

- 选 `http`：显示 URL、UA、interval、filter、exclude-filter、prefix/suffix、健康检查、override
- 选 `inline`：显示节点列表编辑器（见下方"节点编辑器组件"）

#### 编辑 inline 节点源弹窗

- 节点列表（表格）+ "添加节点"按钮
- 底部展示该 provider 生成的 YAML 片段预览（实时）
- 节点编辑使用通用节点表单（见 2.1 节点表单组件）

#### 节点表单组件（`ProxyNodeForm`）

协议下拉切换，字段按协议动态显示：

| 协议 | 必填字段 | 可选字段 |
|------|----------|----------|
| `ss` | cipher, password | plugin, udp |
| `vmess` | uuid, alterId, cipher | network(tcp/ws/grpc), ws-path, ws-host |
| `vless` | uuid | flow, network |
| `trojan` | password | network |
| `hysteria2` | password | obfs, up, down |
| `tuic` | uuid, password | — |
| `http` | — | username, password |
| `socks5` | — | username, password |

非 `ss` 协议显示通用 TLS 设置区：tls, sni, skip-cert-verify, fingerprint, alpn

所有协议共用：name（节点名）、server、port、ip-version、interface-name

底部折叠入口：**粘贴原始 YAML**（textarea，解析后填入表单；解析失败时以 `__raw__` 字段保存）

---

### 2.2 规则集（`/rule-sets`）

**变更：原两个页面合并为一个，tab 切换**

#### Tab 结构

```
全部 (N) | 订阅规则集 (N) | 私有规则集 (N)
```

- **订阅规则集**：原"规则集库"，type=http，URL 指向第三方
- **私有规则集**：原"托管规则集"，内容存本服务，via `/ruleset/:token/:name`

#### 列表（表格）

字段：名称、类型徽标（订阅/私有）、behavior、format、被引用订阅数、操作

#### 添加/编辑弹窗

第一项选择"来源类型"：
- **订阅规则集**：显示 URL、interval、behavior、format、proxy、size-limit、header
- **私有规则集**：显示规则编辑器（文本编辑器，每行一条规则）

---

### 2.3 自定义配置（`/configs`）

**变更：删除"手动节点"tab，代理组 use[] 支持 inline provider**

#### Tab 结构

```
代理组 (N) | 规则 (N) | 全局设置
```

删除原"手动节点"tab。

#### 代理组编辑

`use[]` 字段：
- 以复选框列表展示所有可用 proxy-providers（含 inline 类型）
- inline 类型 provider 显示紫色徽标加 `inline` 小字

`proxies[]` 字段：
- 多选，可选项仅包含内置策略（DIRECT、REJECT）和其他代理组名称
- **不再包含手动节点**（手动节点通过 inline provider → use[] 引入）

#### 配置切换器

顶部 topbar 中的"切换配置"下拉：
- 列出当前用户所有自定义配置（按名称）
- 提供"新建配置"和"复制当前配置"入口

---

### 2.4 订阅管理（`/subscriptions`）

**变更：展开面板显示"组成要素"**

展开一个订阅后，显示四个组成要素块（2×2 grid）：

| 块 | 内容 |
|----|------|
| 📡 节点源 | 已选的 proxy-providers，支持添加/移除 |
| ⚙️ 自定义配置 | 已绑定的 config，支持更换 |
| 📋 规则集 | 从 config 的 RULE-SET 规则自动推断，只读展示 |
| 📄 配置模板 | 已绑定的 template，支持更换 |

规则集自动推断逻辑：扫描自定义配置的 `rules` 字段，提取所有 `RULE-SET,xxx,...` 的 `xxx`，与规则集库/私有规则集名称匹配后展示。

---

## 3. 后端 API 变更

### 3.1 proxy-providers 新增 inline 类型

#### 数据模型变更

文件：`internal/model/provider.go`（或现有 provider 相关 model）

```go
type ProviderType string

const (
    ProviderTypeHTTP   ProviderType = "http"
    ProviderTypeInline ProviderType = "inline"
    // file 类型移除
)

type Provider struct {
    Base
    UserID  uint         `gorm:"not null;index"`
    Name    string       `gorm:"not null"`
    Type    ProviderType `gorm:"not null;default:'http'"`

    // http 类型字段
    URL            string `json:"url,omitempty"`
    Interval       int    `json:"interval,omitempty"`
    UA             string `json:"ua,omitempty"`
    Filter         string `json:"filter,omitempty"`
    ExcludeFilter  string `json:"exclude_filter,omitempty"`
    Prefix         string `json:"prefix,omitempty"`
    Suffix         string `json:"suffix,omitempty"`
    HealthCheckURL string `json:"health_check_url,omitempty"`
    HealthCheckInterval int `json:"health_check_interval,omitempty"`
    OverrideUDP    *bool  `json:"override_udp,omitempty"`

    // inline 类型字段
    // JSON 序列化的 []map[string]interface{}，每项是一个节点
    Payload []map[string]interface{} `gorm:"serializer:json;type:longtext" json:"payload,omitempty"`
}
```

#### 新增/修改接口

```
POST   /api/providers          创建（支持 type=inline）
PUT    /api/providers/:id       更新（支持更新 payload）
GET    /api/providers/:id/nodes 获取 inline provider 的节点列表
POST   /api/providers/:id/nodes 向 inline provider 添加节点
PUT    /api/providers/:id/nodes/:nodeIndex  更新 inline 节点
DELETE /api/providers/:id/nodes/:nodeIndex  删除 inline 节点
```

#### YAML 生成变更

文件：`internal/service/yaml_builder.go`（或现有 YAML 生成逻辑）

inline 类型 provider 生成：

```yaml
proxy-providers:
  家庭节点:
    type: inline
    payload:
      - name: 家庭 SS
        type: ss
        server: home.example.com
        port: 8388
        cipher: chacha20-ietf-poly1305
        password: "xxx"
        udp: true
```

http 类型 provider 生成（保持现有逻辑，移除 file 类型分支）。

---

### 3.2 规则集合并接口

将原有的 `rule-providers`（规则集库）和 `hosted-rule-sets`（托管规则集）统一到一套接口，通过 `source_type` 字段区分：

```
source_type = "external"  →  原规则集库（外部 URL）
source_type = "hosted"    →  原托管规则集（本服务托管）
```

接口路径建议统一为 `/api/rule-sets`（原两套接口可保留做兼容，前端只调用新接口）。

---

### 3.3 订阅组成要素接口

新增：

```
GET /api/subscriptions/:id/components
```

返回：

```json
{
  "providers": [...],        // 已选节点源
  "custom_config": {...},    // 已绑定自定义配置
  "rule_sets": [...],        // 从配置 rules 推断出的规则集
  "template": {...}          // 已绑定模板
}
```

推断规则集的逻辑放在后端：解析 `custom_config.rules` 里的 `RULE-SET,xxx,...`，查找匹配的规则集记录返回。

---

## 4. 实施优先级

| 优先级 | 任务 |
|--------|------|
| P0 | 后端：Provider 模型新增 inline 类型 + 节点 CRUD 接口 |
| P0 | 后端：YAML 生成支持 inline provider（type: inline + payload） |
| P0 | 前端：节点源页面——添加弹窗支持 http/inline 两种类型 |
| P0 | 前端：ProxyNodeForm 组件（协议切换 + 字段联动） |
| P1 | 前端：规则集页面合并（两个页面 → 一个页面 + tab） |
| P1 | 前端：自定义配置删除手动节点 tab，代理组 use[] 显示 inline provider |
| P1 | 前端：订阅管理展示组成要素面板 |
| P2 | 前端：侧边栏更新（新路由 + 流程提示卡片） |
| P2 | 后端：`/api/subscriptions/:id/components` 推断规则集接口 |
| P2 | 后端：移除 file 类型分支，清理相关代码 |

---

## 5. 文件改动清单（前端）

```
frontend/src/
├── components/
│   ├── layout/Sidebar.tsx              修改：新导航结构
│   └── proxy/ProxyNodeForm.tsx         新增：协议切换节点表单
├── pages/
│   ├── Providers.tsx                   修改：新增 inline 类型支持
│   ├── RuleSets.tsx                    新增：合并两个规则集页面
│   ├── Configs.tsx                     修改：删除手动节点 tab，代理组 use[] 更新
│   └── Subscriptions.tsx              修改：新增组成要素面板
├── api/
│   ├── providers.ts                    修改：新增 inline 相关接口
│   └── rule-sets.ts                    新增：统一规则集接口
└── i18n/locales/
    ├── zh.ts                           更新：新增文案 key
    └── en.ts                           更新：新增文案 key
```

---

## 6. 参考资料

- **交互原型**：`prototype.html`（打开后点击侧边栏导航，所有弹窗均可交互）
- **设计决策**：`ux-design-doc.md`
- **Mihomo proxy-providers 文档**：https://wiki.metacubex.one/config/proxy-providers/
- **Mihomo rule-providers 文档**：https://wiki.metacubex.one/config/rule-providers/
