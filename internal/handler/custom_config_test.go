package handler

import "testing"

func TestSanitizeExportFilename(t *testing.T) {
	got := sanitizeExportFilename(`my "special"/config`, 12)
	want := "custom-config-my-special-config-12.json"
	if got != want {
		t.Fatalf("unexpected filename: got %q want %q", got, want)
	}
}

func TestCloneHelpers(t *testing.T) {
	srcRules := []string{"DOMAIN,example.com,DIRECT"}
	clonedRules := cloneSliceStrings(srcRules)
	clonedRules[0] = "MATCH,DIRECT"
	if srcRules[0] == clonedRules[0] {
		t.Fatalf("cloneSliceStrings should copy underlying slice")
	}

	srcMaps := []map[string]interface{}{{"name": "a"}}
	clonedMaps := cloneSliceMaps(srcMaps)
	clonedMaps[0]["name"] = "b"
	if srcMaps[0]["name"] == clonedMaps[0]["name"] {
		t.Fatalf("cloneSliceMaps should deep copy content")
	}
}
