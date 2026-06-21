package util

import "testing"

func TestValidateMihomoRuleLine(t *testing.T) {
	ok := []string{
		"DOMAIN-SUFFIX,google.com,Proxy",
		"IP-CIDR,10.0.0.0/8,DIRECT,no-resolve",
		"MATCH,Proxy",
		"GEOIP,CN,DIRECT",
		"RULE-SET,myrules,Proxy",
		"RULE-SET,myrules,Proxy,no-resolve",
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
