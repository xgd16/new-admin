package middleware

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"new-admin/internal/model"
	"new-admin/internal/service"
)

func clampByte(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

// AuditAuthenticatedWrites 在所有需鉴权的写操作完成后记录一行操作日志（不记录 GET/HEAD/OPTIONS）。
// 须在 RequireAuth 之后注册以便取得 user_id/username。
func AuditAuthenticatedWrites(audit *service.Audit) gin.HandlerFunc {
	return func(c *gin.Context) {
		if audit == nil {
			c.Next()
			return
		}
		start := time.Now()
		c.Next()
		uid, ok := AuthUserID(c)
		if !ok {
			return
		}
		m := strings.ToUpper(c.Request.Method)
		switch m {
		case http.MethodGet, http.MethodHead, http.MethodOptions:
			return
		default:
		}
		durMs := uint32(time.Since(start).Milliseconds())
		if durMs == 0 {
			durMs = 1
		}
		user, _ := AuthUsername(c)
		path := c.FullPath()
		if path == "" {
			path = c.Request.URL.Path
		}
		rawQ := c.Request.URL.RawQuery
		audit.RecordDetached(&model.AdminOperationLog{
			UserID:     uid,
			Username:   clampByte(strings.TrimSpace(user), 64),
			Method:     clampByte(m, 16),
			Path:       clampByte(path, 512),
			Query:      clampByte(rawQ, 2048),
			IP:         clampByte(c.ClientIP(), 64),
			UserAgent:  clampByte(c.Request.UserAgent(), 512),
			StatusCode: c.Writer.Status(),
			DurationMs: durMs,
		})
	}
}
