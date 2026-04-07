---
name: Clash Config Store PRD
overview: 基于访谈结果，全面重构 Clash Config Store 的数据模型与前端交互，引入可视化表单编辑、独立规则集库、可复用配置模板，并增强仪表盘的操作性。
todos:
  - id: phase1-models
    content: "Phase 1: 新增 ConfigTemplate、RuleProvider 模型，修改 CustomConfig（结构化 JSON）和 Subscription（ConfigTemplateID），更新 GORM 自动迁移"
    status: completed
  - id: phase1-generate-yaml
    content: "Phase 1: 重写 BuildMihomoConfig 适配结构化输入（ProxyNode/ProxyGroup/Rules/RuleProviders），移除 Loyalsoldier 硬编码"
    status: completed
  - id: phase1-crud
    content: "Phase 1: 新增 ConfigTemplate CRUD 接口、RuleProvider CRUD 接口 + 内置预设种子数据，更新 CustomConfig/Subscription 接口"
    status: completed
  - id: phase2-custom-config-editor
    content: "Phase 2: CustomConfigDetail 4-Tab 可视化编辑器（Proxies 表单 + Proxy Groups 表单 + Rules 表格 + Rule Sets 多选）"
    status: completed
  - id: phase2-new-pages
    content: "Phase 2: 新建 ConfigTemplates 列表/详情页、RuleProviders 列表/详情页，更新 SubscriptionDetail 使用 ConfigTemplate 选择器，更新导航"
    status: completed
  - id: phase3-dashboard
    content: "Phase 3: 仪表盘重设计（快捷操作栏 + Provider 状态卡片 + 订阅健康卡片 + 访问日志时间线）"
    status: completed
isProject: false
---

# Clash Config Store — 产品需求与重构计划

## 核心问题诊断

| 问题 | 根本原因 |
|---|---|
| 无法可视化编辑 proxies/groups/rules | 三个字段存储为原始 YAML 文本，前端只能用 textarea |
| 规则集过于死板 | 硬编码 Loyalsoldier，无法自定义来源 |
| base_config 无法复用 | 内联在 Subscription 里，每个订阅重复维护 |
| 仪表盘无操作性 | 只有统计数据，所有操作都分散在各子页面 |

---

## 一、新数据模型架构

### 新增：`ConfigTemplate`（配置模板）
多个订阅可复用的顶层 mihomo 设置（mixed-port、mode、dns、tun 等）

```
ConfigTemplate
├── UserID
├── Name
├── Description
└── Content (YAML text — top-level mihomo fields)
```

### 新增：`RuleProvider`（规则集库）
独立管理的规则提供者，可被多个 CustomConfig 引用

```
RuleProvider
├── UserID
├── Name          -- 在配置里引用的唯一键名
├── Type          -- http | file
├── URL           -- http 类型的远程地址
├── Behavior      -- domain | ipcidr | classical
├── Format        -- yaml | text | mrs
├── Interval      -- 刷新间隔（秒）
├── IsPreset      -- bool，内置预设标记
└── PresetTag     -- e.g. "loyalsoldier"
```

### 修改：`CustomConfig`
将三个 YAML 文本字段改为结构化 JSON，移除 Loyalsoldier 专属字段

```diff
 CustomConfig
 ├── UserID
 ├── Name
-├── Proxies        (YAML text)
-├── ProxyGroups    (YAML text)
-├── Rules          (YAML text)
-├── RuleSetPreset
-├── RuleSetCDN
-└── RuleSetProxyGroup
+├── Proxies        (JSON text — []ProxyNode，结构化代理节点)
+├── ProxyGroups    (JSON text — []ProxyGroup，结构化代理组)
+├── Rules          (JSON text — []string，规则行列表)
+└── RuleProviderIDs (JSON text — []uint，引用 RuleProvider)
```

### 修改：`Subscription`
```diff
 Subscription
 ├── ...existing fields...
-└── BaseConfig      (JSON text — 内联顶层配置)
+└── ConfigTemplateID *uint
```

---

## 二、结构化数据格式（前后端共用）

### ProxyNode（JSON 结构）
```json
{
  "name": "家庭宽带",
  "type": "wireguard",
  ... // 每种协议的字段按 mihomo 规范
  "__raw__": null  // 若 type="custom"，存储原始 YAML 片段
}
```
- 支持所有协议：ss / vmess / vless / trojan / hysteria2 / tuic / wireguard / http / socks5
- 未知协议用 `type: "custom"` + `__raw__` 字段保存原始 YAML

### ProxyGroup（JSON 结构）
```json
{
  "name": "🚀 节点选择",
  "type": "select",
  "proxies": ["DIRECT", "🔯 故障转移"],   // 手动列举的节点/组名
  "use": ["机场订阅A"],                    // use: [providerName] 动态引入
  "url": "http://...",
  "interval": 300
}
```

### Rule（字符串列表）
```json
["DOMAIN-SUFFIX,google.com,🚀 节点选择", "GEOIP,CN,DIRECT", "MATCH,🚀 节点选择"]
```

---

## 三、功能模块详细需求

### 3.1 CustomConfig 可视化编辑器

页面采用 **4 个 Tab** 结构：

**Tab 1：Proxies（代理节点）**
- 节点列表，支持增删排序
- 点击节点进入表单弹窗：先选协议类型 → 显示对应字段
- 每种协议对应字段按 mihomo 规范渲染表单输入
- 表单底部有「切换到 YAML 编辑」按钮（fallback 编辑器）

**Tab 2：Proxy Groups（代理组）**
- 组列表，支持增删排序
- 点击进入完整表单弹窗：
  - `name`、`type` 选择器
  - `proxies`：多选框（列出本 config 所有 ProxyNode 名 + 其他组名 + DIRECT/REJECT 等保留词）
  - `use`：多选框（列出当前订阅关联的 Provider 名称，说明"这些节点在生成时动态注入"）
  - 根据 `type` 显示附加字段（url-test 的 url/interval/tolerance；fallback 同；load-balance 加 strategy）

**Tab 3：Rules（规则）**
- 表格编辑：每行 `类型 | 内容 | 目标组` 三列，可增删
- 右上角「切换到原始 YAML」按钮（文本框双向同步）
- 规则类型下拉：DOMAIN、DOMAIN-SUFFIX、DOMAIN-KEYWORD、IP-CIDR、GEOIP、GEOSITE、RULE-SET、MATCH 等

**Tab 4：Rule Sets（规则集）**
- 从全局「规则集库」中勾选需要引入的规则集（多选列表）
- 展示已选规则集的 behavior/url 摘要
- 注意：这里只是引用，不修改规则集本身

**YAML 预览**（浮动按钮）：随时可打开右侧抽屉预览当前会生成的 YAML 片段

---

### 3.2 规则集库（独立页面）

- 列表页：显示所有 RuleProvider，标注是否内置预设
- 新增/编辑表单：name、type、url、behavior、format、interval
- 内置预设（通过 seed 或代码初始化）：Loyalsoldier 白名单/黑名单集，可作为起点让用户参考
- 预设条目不可删除，用户自定义条目可增删

---

### 3.3 配置模板（独立页面）

- 列表页 + 详情编辑页
- 编辑器：YAML 文本编辑器（顶层 mihomo 字段，如 mixed-port、mode、dns、tun、sniffer 等）
- 订阅详情页的"基础配置"从直接编辑 JSON → 改为下拉选择 ConfigTemplate

---

### 3.4 仪表盘重设计

布局：**顶部快捷操作栏 + 三列卡片区 + 最近访问日志**

**快捷操作栏**
- 一键刷新所有 Provider 缓存
- 快速跳转各资源管理页

**Provider 状态卡片区**
- 每个 provider 一个小卡片：名称、最后刷新时间、缓存是否过期、是否有拉取错误
- 点击可触发单个刷新

**订阅健康卡片区**
- 每个订阅：名称、token 过期状态（过期/永久/剩余天数）、关联 config 状态、快速复制订阅链接按钮

**最近访问日志**（保留现有，改为更紧凑的时间线样式）

---

## 四、导航结构调整

```
现有：仪表盘 / Providers / 自定义配置 / 订阅 / UA库 / 设置
新增：配置模板 / 规则集库
```

侧边栏新增两个菜单项：
- **配置模板** — `/config-templates`
- **规则集库** — `/rule-providers`

---

## 五、后端 GenerateYAML 逻辑调整

```
现在：LoadBaseConfig(JSON) + LoadProvidersYAML + ParseRawYAML(custom) + LoyalsoldierInject
之后：LoadConfigTemplate(YAML) + LoadProvidersYAML + SerializeStructuredCustomConfig + InjectRuleProviders
```

`BuildMihomoConfig` 接受结构化输入：
- `[]ProxyNode` → 序列化为 `proxies` 列表
- `[]ProxyGroup` → 序列化为 `proxy-groups` 列表
- `[]string` (rules) → 合并逻辑保持不变
- `[]RuleProvider` → 序列化为 `rule-providers` 映射并注入 `RULE-SET` 规则行

---

## 六、实施阶段

### Phase 1：数据层重构（后端为主）
- 新增 `ConfigTemplate` 模型 + CRUD 接口
- 新增 `RuleProvider` 模型 + CRUD 接口 + 内置预设种子
- 修改 `CustomConfig` 模型（结构化 JSON 替代 YAML 文本）
- 修改 `Subscription` 模型（ConfigTemplateID）
- 更新 `GenerateYAML` / `BuildMihomoConfig` 适配新结构

### Phase 2：前端可视化编辑
- CustomConfigDetail 4-Tab 重设计（核心工程量）
- 新建 ConfigTemplates 页面对
- 新建 RuleProviders 页面
- 更新 SubscriptionDetail（Config Template 选择器）

### Phase 3：仪表盘增强
- 仪表盘布局重设计
- Provider 状态卡片 + 订阅健康卡片
- 快捷操作接入现有接口
