package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"new-admin/internal/jwtissuer"
	"new-admin/pkg/errcode"
	"new-admin/pkg/response"
)

const (
	CtxAuthUserIDKey   = "auth_uid"
	CtxAuthUsernameKey = "auth_username"
)

func RequireAuth(j *jwtissuer.Issuer) gin.HandlerFunc {
	return func(c *gin.Context) {
		h := strings.TrimSpace(c.GetHeader("Authorization"))
		parts := strings.SplitN(h, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" || parts[1] == "" {
			response.Fail(c, http.StatusUnauthorized, errcode.Unauthorized, "未提供有效凭证")
			c.Abort()
			return
		}
		raw := strings.TrimSpace(parts[1])
		claims, err := j.Parse(raw)
		if err != nil {
			response.Fail(c, http.StatusUnauthorized, errcode.Unauthorized, "登录已失效或令牌无效")
			c.Abort()
			return
		}
		c.Set(CtxAuthUserIDKey, claims.UserID)
		c.Set(CtxAuthUsernameKey, claims.Username)
		c.Next()
	}
}

func AuthUsername(c *gin.Context) (string, bool) {
	v, ok := c.Get(CtxAuthUsernameKey)
	if !ok {
		return "", false
	}
	s, ok := v.(string)
	s = strings.TrimSpace(s)
	return s, ok && s != ""
}

func AuthUserID(c *gin.Context) (uint64, bool) {
	v, ok := c.Get(CtxAuthUserIDKey)
	if !ok {
		return 0, false
	}
	id, ok := v.(uint64)
	return id, ok
}
