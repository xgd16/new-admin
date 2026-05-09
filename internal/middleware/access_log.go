package middleware

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// ZapAccessLog 记录一行访问日志。
// 状态码不在 msg 内着色，以便同一条日志同时写文件时不含 ANSI 转义；控制台仍可通过 zap 的级别样式区分严重程度。
func ZapAccessLog(log *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		path := c.FullPath()
		if path == "" {
			path = c.Request.URL.Path
		}
		query := c.Request.URL.RawQuery

		c.Next()

		latency := time.Since(start)
		status := c.Writer.Status()
		rid, _ := c.Get(CtxRequestID)

		target := path
		if query != "" {
			target = path + "?" + query
		}

		var b strings.Builder
		fmt.Fprintf(&b, "%s %s | %s | %s | ip=%s",
			c.Request.Method,
			target,
			formatStatusCode(status),
			formatLatency(latency),
			c.ClientIP(),
		)
		if rid != nil {
			fmt.Fprintf(&b, " | rid=%v", rid)
		}
		if len(c.Errors) > 0 {
			fmt.Fprintf(&b, " | gin_errors=%s", c.Errors.String())
		}

		msg := b.String()
		switch {
		case status >= 500:
			log.Error(msg)
		case status >= 400:
			log.Warn(msg)
		default:
			log.Info(msg)
		}
	}
}

func formatStatusCode(code int) string {
	return strconv.Itoa(code)
}

func formatLatency(d time.Duration) string {
	switch {
	case d < time.Microsecond:
		return fmt.Sprintf("%dns", d.Nanoseconds())
	case d < time.Millisecond:
		return fmt.Sprintf("%dµs", d.Microseconds())
	case d < time.Second:
		return fmt.Sprintf("%.2fms", float64(d.Nanoseconds())/1e6)
	default:
		return fmt.Sprintf("%.2fs", d.Seconds())
	}
}
