package subscription

import "encoding/json"

// EnabledProviderIDsToStore 将 ID 列表序列化为与 model.Subscription.EnabledProviderIDs 一致的 JSON 文本（nil 视为空列表）
func EnabledProviderIDsToStore(ids []uint) string {
	if ids == nil {
		ids = []uint{}
	}
	b, _ := json.Marshal(ids)
	return string(b)
}

// PatchEnabledProviderIDs 部分更新语义：patch 为 nil 时保留 current；否则写入 patch 的序列化结果
func PatchEnabledProviderIDs(current string, patch *[]uint) string {
	if patch == nil {
		return current
	}
	return EnabledProviderIDsToStore(*patch)
}
