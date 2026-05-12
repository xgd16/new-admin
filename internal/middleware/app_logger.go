package middleware

import (
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// CtxAppLoggerKey Gin Context 中存放 *zap.Logger 的键（供 handler 打错误明细）。
const CtxAppLoggerKey = "app_logger"

// WithAppLogger 注入应用主日志器，须在 RequestID 之后注册，以便字段可带 request_id。
func WithAppLogger(log *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		if log != nil {
			c.Set(CtxAppLoggerKey, log)
		}
		c.Next()
	}
}

// AppLoggerFrom 读取注入的 Logger；缺失时返回 no-op，避免在测试中误 panic。
func AppLoggerFrom(c *gin.Context) *zap.Logger {
	v, ok := c.Get(CtxAppLoggerKey)
	if !ok {
		return zap.NewNop()
	}
	l, _ := v.(*zap.Logger)
	if l == nil {
		return zap.NewNop()
	}
	return l
}
