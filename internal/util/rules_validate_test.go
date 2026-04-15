package util

import "testing"

func TestValidateMihomoRuleLine(t *testing.T) {
	ok := []string{
		"DOMAIN-SUFFIX,google.com,Proxy",
		"IP-CIDR,10.0.0.0/8,DIRECT,no-resolve",
		"MATCH,Proxy",
		"GEOIP,CN,DIRECT",
		"RULE-SET,myrules,Proxy",
	}
	for _, s := range ok {
		if err := validateMihomoRuleLine(s); err != nil {
			t.Errorf("expected ok %q: %v", s, err)
		}
	}
	bad := []string{
		"",
		"TYPO,google.com,Proxy",
		"DOMAIN-SUFFIX,,Proxy",
		"DOMAIN-SUFFIX,google.com,",
		"MATCH,",
		"GEOIP,",
	}
	for _, s := range bad {
		if err := validateMihomoRuleLine(s); err == nil {
			t.Errorf("expected error for %q", s)
		}
	}
}

func TestValidateCustomConfigRules_YAMLVsLines(t *testing.T) {
	if err := ValidateCustomConfigRules("DOMAIN-SUFFIX,a.com,Proxy\nMATCH,DIRECT"); err != nil {
		t.Fatal(err)
	}
	if err := ValidateCustomConfigRules("- DOMAIN-SUFFIX,a.com,Proxy\n- MATCH,DIRECT"); err != nil {
		t.Fatal(err)
	}
	if err := ValidateCustomConfigRules("DOMAIN-SUFFIX,a.com,Proxy\n- MATCH,DIRECT"); err == nil {
		t.Fatal("expected mixed format error")
	}
}

func TestValidateCustomConfigProxies(t *testing.T) {
	if err := ValidateCustomConfigProxies(`- name: "a"
  type: ss
  server: x
  port: 443
  cipher: x
  password: p`); err != nil {
		t.Fatal(err)
	}
	if err := ValidateCustomConfigProxies(`- name: ""
  type: ss`); err == nil {
		t.Fatal("expected empty name error")
	}
}

func TestValidateCustomConfigProxyGroups(t *testing.T) {
	yml := `- name: P
  type: select
  proxies:
    - DIRECT`
	if err := ValidateCustomConfigProxyGroups(yml); err != nil {
		t.Fatal(err)
	}
	if err := ValidateCustomConfigProxyGroups(`- name: P
  type: select`); err == nil {
		t.Fatal("expected missing proxies")
	}
}
