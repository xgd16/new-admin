package middleware

import (
	"net/http"
	"runtime/debug"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// ZapRecovery 替代 gin.Recovery：将 panic 与堆栈写入 zap（终端/文件按配置），HTTP 仍返回 500。
func ZapRecovery(log *zap.Logger) gin.HandlerFunc {
	if log == nil {
		log = zap.NewNop()
	}
	return func(c *gin.Context) {
		defer func() {
			if err := recover(); err != nil {
				path := c.FullPath()
				if path == "" {
					path = c.Request.URL.Path
				}
				fields := []zap.Field{
					zap.Any("panic", err),
					zap.String("path", path),
					zap.String("method", c.Request.Method),
					zap.ByteString("stack", debug.Stack()),
				}
				if rid, ok := c.Get(CtxRequestID); ok {
					fields = append(fields, zap.Any("request_id", rid))
				}
				log.Error("panic_recovered", fields...)
				c.AbortWithStatus(http.StatusInternalServerError)
			}
		}()
		c.Next()
	}
}
