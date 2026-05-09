package middleware

import (
	"slices"
	"strings"

	"github.com/gin-gonic/gin"
)

const (
	corsExposeHeaders      = "X-Request-ID, Content-Disposition"
	corsAllowedHeaders     = "Authorization, Content-Type, X-Request-ID"
	corsAllowedMethods     = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
	corsPreflightMaxAgeSec = "86400"
)

// CORS 按允许的 Origin 精确回显 Allow-Origin；未命中列表则不返回跨域响应头。
func CORS(allowedOrigins []string) gin.HandlerFunc {
	var clean []string
	for _, o := range allowedOrigins {
		if t := strings.TrimSpace(o); t != "" {
			clean = append(clean, t)
		}
	}
	uniq := slices.Clone(clean)
	slices.Sort(uniq)
	uniq = slices.Compact(uniq)

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")

		isAllowed := false
		var mirror string
		for _, want := range uniq {
			if want != "" && want == origin {
				isAllowed = true
				mirror = origin
				break
			}
		}

		if isAllowed {
			c.Header("Access-Control-Allow-Origin", mirror)
			c.Header("Access-Control-Expose-Headers", corsExposeHeaders)
		}
		c.Header("Access-Control-Allow-Headers", corsAllowedHeaders)
		c.Header("Access-Control-Allow-Methods", corsAllowedMethods)
		c.Header("Access-Control-Max-Age", corsPreflightMaxAgeSec)

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	}
}
