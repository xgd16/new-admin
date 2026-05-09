package config

import "testing"

func TestParseHumanSizeToLumberjackMiB(t *testing.T) {
	tests := []struct {
		raw  string
		want int
	}{
		{"50M", 50},
		{"50MB", 50},
		{"50m", 50},
		{"1G", 1024},
		{"1GB", 1024},
		{"512KB", 1},
		{"50", 50},
		{"0M", 0},
		{"0", 0},
	}
	for _, tc := range tests {
		got, err := parseHumanSizeToLumberjackMiB(tc.raw)
		if err != nil {
			t.Fatalf("%q: %v", tc.raw, err)
		}
		if got != tc.want {
			t.Fatalf("%q: got %d want %d", tc.raw, got, tc.want)
		}
	}
}

func TestParseHumanSizeToLumberjackMiB_invalid(t *testing.T) {
	for _, raw := range []string{"MB", "x", "-1M"} {
		if _, err := parseHumanSizeToLumberjackMiB(raw); err == nil {
			t.Fatalf("%q: expected error", raw)
		}
	}
}
