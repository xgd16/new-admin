package handler

import (
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"new-admin/internal/middleware"
)

func logHandlerErr(c *gin.Context, event string, err error) {
	if err == nil {
		return
	}
	log := middleware.AppLoggerFrom(c)
	path := c.FullPath()
	if path == "" {
		path = c.Request.URL.Path
	}
	fields := []zap.Field{
		zap.Error(err),
		zap.String("path", path),
		zap.String("method", c.Request.Method),
	}
	if rid, ok := c.Get(middleware.CtxRequestID); ok {
		fields = append(fields, zap.Any("request_id", rid))
	}
	log.Error(event, fields...)
}

func logBindJSON(c *gin.Context, err error) {
	if err == nil {
		return
	}
	log := middleware.AppLoggerFrom(c)
	path := c.FullPath()
	if path == "" {
		path = c.Request.URL.Path
	}
	fields := []zap.Field{
		zap.Error(err),
		zap.String("path", path),
		zap.String("method", c.Request.Method),
	}
	if rid, ok := c.Get(middleware.CtxRequestID); ok {
		fields = append(fields, zap.Any("request_id", rid))
	}
	log.Warn("bind_json_failed", fields...)
}
