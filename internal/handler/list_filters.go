package handler

import (
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func parseOptionalStatusQuery(s string) (*int8, bool) {
	s = strings.TrimSpace(s)
	if s == "" || strings.EqualFold(s, "all") {
		return nil, true
	}
	switch s {
	case "0":
		v := int8(0)
		return &v, true
	case "1":
		v := int8(1)
		return &v, true
	default:
		return nil, false
	}
}

func endOfDayLocal(t time.Time) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d, 23, 59, 59, 999999999, t.Location())
}

// parseCreatedRangeFromQuery 解析 created_from、created_to（YYYY-MM-DD），区间无效时返回 ok=false。
func parseCreatedRangeFromQuery(c *gin.Context) (from *time.Time, to *time.Time, ok bool) {
	if s := strings.TrimSpace(c.Query("created_from")); s != "" {
		t0, err := time.ParseInLocation("2006-01-02", s, time.Local)
		if err != nil {
			return nil, nil, false
		}
		from = &t0
	}
	if s := strings.TrimSpace(c.Query("created_to")); s != "" {
		t0, err := time.ParseInLocation("2006-01-02", s, time.Local)
		if err != nil {
			return nil, nil, false
		}
		end := endOfDayLocal(t0)
		to = &end
	}
	if from != nil && to != nil && from.After(*to) {
		return nil, nil, false
	}
	return from, to, true
}
