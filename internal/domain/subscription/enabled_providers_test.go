package subscription

import "testing"

func TestEnabledProviderIDsToStore(t *testing.T) {
	t.Parallel()
	if got := EnabledProviderIDsToStore(nil); got != "[]" {
		t.Fatalf("nil slice: 视为空列表，want [], got %q", got)
	}
	if got := EnabledProviderIDsToStore([]uint{}); got != "[]" {
		t.Fatalf("empty: want [], got %q", got)
	}
	if got := EnabledProviderIDsToStore([]uint{1, 2, 3}); got != "[1,2,3]" {
		t.Fatalf("ids: want [1,2,3], got %q", got)
	}
}

func TestPatchEnabledProviderIDs(t *testing.T) {
	t.Parallel()
	current := "[9,8]"

	if got := PatchEnabledProviderIDs(current, nil); got != current {
		t.Fatalf("patch nil: want %q, got %q", current, got)
	}

	empty := []uint{}
	if got := PatchEnabledProviderIDs(current, &empty); got != "[]" {
		t.Fatalf("patch empty slice: want [], got %q", got)
	}

	patch := []uint{1, 2}
	if got := PatchEnabledProviderIDs(current, &patch); got != "[1,2]" {
		t.Fatalf("patch ids: want [1,2], got %q", got)
	}
}
