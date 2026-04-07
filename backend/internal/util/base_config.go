package util

import (
	"encoding/json"
	"fmt"
	"strings"
)

// BaseConfigKnown 描述订阅 base_config（JSON）中常见顶层字段的类型，键名与 mihomo 一致。
// 仅用于校验已知字段类型；JSON 中其它键原样保留，由 BuildMihomoConfig 合并进最终 YAML。
type BaseConfigKnown struct {
	Port                    *int     `json:"port,omitempty"`
	SocksPort               *int     `json:"socks-port,omitempty"`
	RedirPort               *int     `json:"redir-port,omitempty"`
	TProxyPort              *int     `json:"tproxy-port,omitempty"`
	MixedPort               *int     `json:"mixed-port,omitempty"`
	AllowLan                *bool    `json:"allow-lan,omitempty"`
	BindAddress             *string  `json:"bind-address,omitempty"`
	Mode                    *string  `json:"mode,omitempty"`
	LogLevel                *string  `json:"log-level,omitempty"`
	IPv6                    *bool    `json:"ipv6,omitempty"`
	UnifiedDelay            *bool    `json:"unified-delay,omitempty"`
	GeodataMode             *bool    `json:"geodata-mode,omitempty"`
	GeodataLoader           *string  `json:"geodata-loader,omitempty"`
	GeositeMatcher          *string  `json:"geosite-matcher,omitempty"`
	TCPConcurrent           *bool    `json:"tcp-concurrent,omitempty"`
	GeoAutoUpdate           *bool    `json:"geo-auto-update,omitempty"`
	GeoUpdateInterval       *int     `json:"geo-update-interval,omitempty"`
	RoutingMark             *int     `json:"routing-mark,omitempty"`
	InboundTfo              *bool    `json:"inbound-tfo,omitempty"`
	InboundMPTCP            *bool    `json:"inbound-mptcp,omitempty"`
	Authentication          []string `json:"authentication,omitempty"`
	ExternalController      *string  `json:"external-controller,omitempty"`
	ExternalControllerUnix  *string  `json:"external-controller-unix,omitempty"`
	ExternalControllerPipe  *string  `json:"external-controller-pipe,omitempty"`
	ExternalControllerTLS   *string  `json:"external-controller-tls,omitempty"`
	ExternalUI              *string  `json:"external-ui,omitempty"`
	ExternalUIURL           *string  `json:"external-ui-url,omitempty"`
	ExternalUIName          *string  `json:"external-ui-name,omitempty"`
	ExternalDohServer       *string  `json:"external-doh-server,omitempty"`
	Secret                  *string  `json:"secret,omitempty"`
	InterfaceName           *string  `json:"interface-name,omitempty"`
	GlobalClientFingerprint *string  `json:"global-client-fingerprint,omitempty"`
	GlobalUA                *string  `json:"global-ua,omitempty"`
	ETagSupport             *bool    `json:"etag-support,omitempty"`
	KeepAliveIdle           *int     `json:"keep-alive-idle,omitempty"`
	KeepAliveInterval       *int     `json:"keep-alive-interval,omitempty"`
	DisableKeepAlive        *bool    `json:"disable-keep-alive,omitempty"`
	ShadowSocksConfig       *string  `json:"ss-config,omitempty"`
	VmessConfig             *string  `json:"vmess-config,omitempty"`
}

// 若存在则须为 JSON 对象（与 mihomo 顶层结构一致）
var baseConfigMustBeObject = []string{
	"dns",
	"tun",
	"tuic-server",
	"experimental",
	"profile",
	"tls",
	"sniffer",
	"geox-url",
	"iptables",
	"ntp",
	"hosts",
	"proxy-providers",
	"rule-providers",
	"sub-rules",
	"external-controller-cors",
	"clash-for-android",
}

// 若存在则须为 JSON 数组
var baseConfigMustBeArray = []string{
	"listeners",
	"tunnels",
	"rules",
}

// ValidateSubscriptionBaseConfig 校验订阅的 base_config 文本：须为 JSON 对象，已知标量字段类型正确，部分嵌套键须为对象/数组。
// 若含 rule（mihomo JSON 键名）或 rules，则逐项校验规则语法。空字符串视为合法。
func ValidateSubscriptionBaseConfig(raw string) error {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}

	var obj map[string]json.RawMessage
	if err := json.Unmarshal([]byte(raw), &obj); err != nil {
		return fmt.Errorf("base_config 须为合法 JSON 对象: %w", err)
	}
	if obj == nil {
		return fmt.Errorf("base_config 不能为 null，请使用 {} 或留空")
	}

	var known BaseConfigKnown
	if err := json.Unmarshal([]byte(raw), &known); err != nil {
		return fmt.Errorf("base_config 已知字段类型不正确: %w", err)
	}

	for _, k := range baseConfigMustBeObject {
		rawMsg, ok := obj[k]
		if !ok {
			continue
		}
		if isJSONNull(rawMsg) {
			continue
		}
		var m map[string]json.RawMessage
		if err := json.Unmarshal(rawMsg, &m); err != nil || m == nil {
			return fmt.Errorf("base_config 中 %q 须为 JSON 对象", k)
		}
	}

	for _, k := range baseConfigMustBeArray {
		rawMsg, ok := obj[k]
		if !ok {
			continue
		}
		if isJSONNull(rawMsg) {
			continue
		}
		var a []json.RawMessage
		if err := json.Unmarshal(rawMsg, &a); err != nil {
			return fmt.Errorf("base_config 中 %q 须为 JSON 数组", k)
		}
	}

	// mihomo RawConfig 对规则的 JSON 键为 "rule"，常见写法为 "rules"，两处均校验内容
	for _, key := range []string{"rule", "rules"} {
		rawMsg, ok := obj[key]
		if !ok || isJSONNull(rawMsg) {
			continue
		}
		var lines []string
		if err := json.Unmarshal(rawMsg, &lines); err != nil {
			return fmt.Errorf("base_config 中 %q 须为 JSON 字符串数组", key)
		}
		for i, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" {
				return fmt.Errorf("base_config.%s 第 %d 项为空", key, i+1)
			}
			if err := validateMihomoRuleLine(line); err != nil {
				return fmt.Errorf("base_config.%s 第 %d 项: %w", key, i+1, err)
			}
		}
	}

	return nil
}

func isJSONNull(b json.RawMessage) bool {
	return strings.TrimSpace(string(b)) == "null"
}
