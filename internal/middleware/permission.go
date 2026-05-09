package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"new-admin/internal/repository"
	"new-admin/pkg/errcode"
	"new-admin/pkg/response"
)

// RequirePermission 需在 RequireAuth 之后注册；perm 与 permissions.code 一致。
func RequirePermission(perm string, rbac *repository.RBAC, log *zap.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		uid, ok := AuthUserID(c)
		if !ok {
			response.Fail(c, http.StatusUnauthorized, errcode.Unauthorized, "未登录")
			c.Abort()
			return
		}
		has, err := rbac.UserHasPermission(c.Request.Context(), uid, perm)
		if err != nil {
			log.Error("permission_check", zap.String("permission", perm), zap.Uint64("user_id", uid), zap.Error(err))
			response.Fail(c, http.StatusInternalServerError, errcode.InternalError, "服务异常")
			c.Abort()
			return
		}
		if !has {
			response.Fail(c, http.StatusForbidden, errcode.Forbidden, "无权访问")
			c.Abort()
			return
		}
		c.Next()
	}
}
