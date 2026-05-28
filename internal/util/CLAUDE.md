# CLAUDE.md — internal/util

## 测试覆盖要求

修改 `yaml.go`、`rules_validate.go`、`base_config.go` 后必须同步补充或更新对应测试：

| 文件 | 测试文件 |
|---|---|
| `yaml.go` | `yaml_ruleset_test.go` |
| `rules_validate.go` | `rules_validate_test.go` |
| `base_config.go` | `base_config_test.go` |

运行：`go test ./internal/util/...`

## BuildMihomoConfig 核心约定（yaml.go）

**`dialer-proxy` 字段处理**：代理节点若含非空 `dialer-proxy` 字段，会被移出 `proxies` 列表，改为生成 `proxy-providers`（inline 类型，通过 `override.dialer-proxy` 注入）。`dialer-proxy` 字段本身从代理节点中删除。订阅级 `subscriptionDialerProxy` 非空时，所有 Provider 节点均走此路径。

**`use:` 展开**：proxy-group 中的 `use: [providerName, ...]` 会展开为对应 Provider 的具体节点名，追加到 `proxies` 列表后，`use` 字段从输出中移除。订阅中未启用该 Provider 时，展开结果为空（节点来源缺失）。

**rule-providers 合并**：注入的 `RuleProviderInput` 条目先构建 map，再与 ConfigTemplate 中已有的 `rule-providers` 合并——模板中同名条目覆盖注入条目（模板优先）。**规则集名称冲突会静默覆盖**，需在调用方确保唯一性。

**ruleInsertMode**：默认 `prepend`（自定义规则在模板规则之前）。`append` 追加到后面，`replace` 完全替换模板规则。

**rule-provider 路径**：固定生成为 `./ruleset/{name}.yaml`，name 即 `RuleProviderInput.Name`。

## 规则校验约定（rules_validate.go）

规则文本支持两种格式，由 `rulesInputUsesYAMLListSyntax` 自动判断：
- **YAML 列表**：以 `[` 开头或首个非空行以 `-` 开头，整块 YAML 解析
- **换行分隔**：每行一条规则，行首不能有 `- `（会报错提示）

`NOT / OR / AND / SUB-RULE / DOMAIN-REGEX / PROCESS-NAME-REGEX / PROCESS-PATH-REGEX` 这几种类型的 payload 可含逗号，target 固定取最后一段。其余类型逗号即字段分隔符。

## base_config 格式（base_config.go）

`Subscription.BaseConfig` 是 **JSON**，不是 YAML。`ValidateSubscriptionBaseConfig` 校验：
- 顶层必须是 JSON 对象（非 null）
- 已知标量字段类型（见 `BaseConfigKnown`）
- `dns / tun / rule-providers` 等嵌套键须为对象，`rules / listeners` 须为数组
- `rule` / `rules` 数组中每项规则语法复用 `validateMihomoRuleLine`
