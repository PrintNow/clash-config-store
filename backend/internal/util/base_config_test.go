package util

import "testing"

func TestValidateSubscriptionBaseConfig(t *testing.T) {
	tests := []struct {
		raw string
		ok  bool
	}{
		{``, true},
		{`   `, true},
		{`{}`, true},
		{`{"mixed-port":7890,"allow-lan":false,"mode":"rule","log-level":"info"}`, true},
		{`{"dns":{"enable":true}}`, true},
		{`{"dns":null}`, true},
		{`{"unknown-key":[1,2,3]}`, true},
		{`[]`, false},
		{`"x"`, false},
		{`null`, false},
		{`{"mixed-port":"bad"}`, false},
		{`{"dns":"no"}`, false},
		{`{"listeners":{}}`, false},
		{`{"listeners":[]}`, true},
		{`{"rules":["MATCH,DIRECT"]}`, true},
		{`{"rule":["MATCH,DIRECT"]}`, true},
		{`{"rules":["TYPO,a,b"]}`, false},
	}
	for _, tt := range tests {
		err := ValidateSubscriptionBaseConfig(tt.raw)
		if tt.ok && err != nil {
			t.Errorf("expected ok, raw=%q err=%v", tt.raw, err)
		}
		if !tt.ok && err == nil {
			t.Errorf("expected error, raw=%q", tt.raw)
		}
	}
}
