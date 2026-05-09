package logger

import (
	"testing"
	"time"
)

func TestExpandLogFilePath(t *testing.T) {
	tm := time.Date(2026, 5, 8, 20, 30, 45, 0, time.Local)
	got := expandLogFilePath(`logs/new-admin-{2006-01-02_15-04-05}.log`, tm)
	want := `logs/new-admin-2026-05-08_20-30-45.log`
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
	if expandLogFilePath("logs/fixed.log", tm) != "logs/fixed.log" {
		t.Fatal("no braces should pass through")
	}
	emptyBraceTM := time.Date(2026, 1, 2, 3, 4, 5, 0, time.Local)
	got2 := expandLogFilePath(`logs/app-{}.log`, emptyBraceTM)
	if got2 != `logs/app-2026-01-02_03-04-05.log` {
		t.Fatalf("empty brace layout: got %q", got2)
	}
}
