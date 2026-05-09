package handler

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"go.uber.org/zap"
	"new-admin/internal/jwtissuer"
	"new-admin/internal/middleware"
	"new-admin/internal/model"
	"new-admin/internal/repository"
	"new-admin/internal/service"
	"new-admin/pkg/errcode"
	"new-admin/pkg/response"
	"new-admin/pkg/xlsx"
)

type System struct {
	svc   *service.System
	audit *service.Audit
}

func NewSystem(svc *service.System, audit *service.Audit) *System {
	return &System{svc: svc, audit: audit}
}

func (h *System) Register(r *gin.RouterGroup, jwt *jwtissuer.Issuer, rbac *repository.RBAC, log *zap.Logger) {
	g := r.Group("")
	g.Use(middleware.RequireAuth(jwt))
	g.Use(middleware.AuditAuthenticatedWrites(h.audit))

	og := g.Group("/system/operation-logs")
	og.GET("/export", middleware.RequirePermission("system:audit:read", rbac, log), h.exportOperationLogs)
	og.GET("", middleware.RequirePermission("system:audit:read", rbac, log), h.listOperationLogs)

	us := g.Group("/system/users")
	us.GET("", middleware.RequirePermission("system:user:read", rbac, log), h.listUsers)
	us.GET("/:id", middleware.RequirePermission("system:user:read", rbac, log), h.getUser)
	us.POST("", middleware.RequirePermission("system:user:write", rbac, log), h.createUser)
	us.PATCH("/:id", middleware.RequirePermission("system:user:write", rbac, log), h.updateUser)

	rs := g.Group("/system/roles")
	rs.GET("", middleware.RequirePermission("system:role:read", rbac, log), h.listRoles)
	rs.GET("/:id", middleware.RequirePermission("system:role:read", rbac, log), h.getRole)
	rs.POST("", middleware.RequirePermission("system:role:write", rbac, log), h.createRole)
	rs.PATCH("/:id/permissions", middleware.RequirePermission("system:role:write", rbac, log), h.updateRolePermissions)

	ps := g.Group("/system/permissions")
	ps.GET("", middleware.RequirePermission("system:role:read", rbac, log), h.listPermissions)
}

func parseQueryInt(c *gin.Context, key string, def int) int {
	s := c.Query(key)
	if s == "" {
		return def
	}
	n, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return n
}

func parseUint64Param(c *gin.Context, key string) (uint64, bool) {
	s := c.Param(key)
	if s == "" {
		return 0, false
	}
	n, err := strconv.ParseUint(s, 10, 64)
	if err != nil {
		return 0, false
	}
	return n, true
}

func (h *System) listOperationLogs(c *gin.Context) {
	page := parseQueryInt(c, "page", 1)
	pageSize := parseQueryInt(c, "page_size", 20)
	out, err := h.audit.ListLogs(c.Request.Context(), page, pageSize)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, errcode.InternalError, "服务异常")
		return
	}
	response.OK(c, out)
}

func (h *System) exportOperationLogs(c *gin.Context) {
	limit := parseQueryInt(c, "limit", 10_000)
	if limit < 1 {
		limit = 10_000
	}
	if limit > 50_000 {
		limit = 50_000
	}
	data, filename, err := h.audit.ExportOperationLogsXLSX(c.Request.Context(), limit)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, errcode.InternalError, "导出失败")
		return
	}
	xlsx.WriteAttachment(c, filename, data)
}

func parseSystemUserListParams(c *gin.Context) (*model.SystemUserListParams, bool) {
	p := &model.SystemUserListParams{
		Keyword: strings.TrimSpace(c.Query("q")),
	}
	st, ok := parseOptionalStatusQuery(c.Query("status"))
	if !ok {
		return nil, false
	}
	p.Status = st
	from, to, ok := parseCreatedRangeFromQuery(c)
	if !ok {
		return nil, false
	}
	p.CreatedFrom, p.CreatedTo = from, to
	if s := strings.TrimSpace(c.Query("role_id")); s != "" {
		n, err := strconv.ParseUint(s, 10, 64)
		if err != nil || n == 0 {
			return nil, false
		}
		p.RoleID = &n
	}
	return p, true
}

func (h *System) listUsers(c *gin.Context) {
	params, ok := parseSystemUserListParams(c)
	if !ok {
		response.Fail(c, http.StatusBadRequest, errcode.BadRequest, "筛选参数无效（请检查状态、日期或角色）")
		return
	}
	out, err := h.svc.ListUsers(c.Request.Context(), parseQueryInt(c, "page", 1), parseQueryInt(c, "page_size", 20), params)
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, errcode.InternalError, "服务异常")
		return
	}
	response.OK(c, out)
}

func (h *System) getUser(c *gin.Context) {
	id, ok := parseUint64Param(c, "id")
	if !ok {
		response.Fail(c, http.StatusBadRequest, errcode.BadRequest, "无效的用户 ID")
		return
	}
	out, err := h.svc.GetUser(c.Request.Context(), id)
	switch {
	case err == nil:
		response.OK(c, out)
	case errors.Is(err, service.ErrSystemUserNotFound):
		response.Fail(c, http.StatusNotFound, errcode.NotFound, "用户不存在")
	default:
		response.Fail(c, http.StatusInternalServerError, errcode.InternalError, "服务异常")
	}
}

func (h *System) createUser(c *gin.Context) {
	var req model.SystemUserCreateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, errcode.BadRequest, "参数错误")
		return
	}
	out, err := h.svc.CreateUser(c.Request.Context(), &req)
	switch {
	case err == nil:
		response.OK(c, out)
	case errors.Is(err, service.ErrSystemDuplicateUsername):
		response.Fail(c, http.StatusConflict, errcode.BadRequest, "用户名已存在")
	case errors.Is(err, service.ErrSystemInvalidRole):
		response.Fail(c, http.StatusBadRequest, errcode.BadRequest, "角色无效")
	default:
		response.Fail(c, http.StatusInternalServerError, errcode.InternalError, "服务异常")
	}
}

func (h *System) updateUser(c *gin.Context) {
	id, ok := parseUint64Param(c, "id")
	if !ok {
		response.Fail(c, http.StatusBadRequest, errcode.BadRequest, "无效的用户 ID")
		return
	}
	uid, ok := middleware.AuthUserID(c)
	if !ok {
		response.Fail(c, http.StatusUnauthorized, errcode.Unauthorized, "未登录")
		return
	}
	var req model.SystemUserUpdateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, errcode.BadRequest, "参数错误")
		return
	}
	out, err := h.svc.UpdateUser(c.Request.Context(), uid, id, &req)
	switch {
	case err == nil:
		response.OK(c, out)
	case errors.Is(err, service.ErrSystemUserNotFound):
		response.Fail(c, http.StatusNotFound, errcode.NotFound, "用户不存在")
	case errors.Is(err, service.ErrSystemDuplicateUsername):
		response.Fail(c, http.StatusConflict, errcode.BadRequest, "用户名已存在")
	case errors.Is(err, service.ErrSystemCannotDisableSelf):
		response.Fail(c, http.StatusBadRequest, errcode.BadRequest, "不能禁用自己的账号")
	case errors.Is(err, service.ErrSystemWeakPassword):
		response.Fail(c, http.StatusBadRequest, errcode.BadRequest, "密码至少 6 位")
	case errors.Is(err, service.ErrSystemInvalidRole):
		response.Fail(c, http.StatusBadRequest, errcode.BadRequest, "角色无效")
	case errors.Is(err, service.ErrSystemBadRequest):
		response.Fail(c, http.StatusBadRequest, errcode.BadRequest, "参数无效")
	default:
		response.Fail(c, http.StatusInternalServerError, errcode.InternalError, "服务异常")
	}
}

func (h *System) listRoles(c *gin.Context) {
	out, err := h.svc.ListRoles(c.Request.Context())
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, errcode.InternalError, "服务异常")
		return
	}
	response.OK(c, out)
}

func (h *System) getRole(c *gin.Context) {
	id, ok := parseUint64Param(c, "id")
	if !ok {
		response.Fail(c, http.StatusBadRequest, errcode.BadRequest, "无效的角色 ID")
		return
	}
	out, err := h.svc.GetRole(c.Request.Context(), id)
	switch {
	case err == nil:
		response.OK(c, out)
	case errors.Is(err, service.ErrSystemRoleNotFound):
		response.Fail(c, http.StatusNotFound, errcode.NotFound, "角色不存在")
	default:
		response.Fail(c, http.StatusInternalServerError, errcode.InternalError, "服务异常")
	}
}

func (h *System) createRole(c *gin.Context) {
	var req model.SystemRoleCreateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, errcode.BadRequest, "参数错误")
		return
	}
	out, err := h.svc.CreateRole(c.Request.Context(), &req)
	switch {
	case err == nil:
		response.OK(c, out)
	case errors.Is(err, service.ErrSystemDuplicateRoleCode):
		response.Fail(c, http.StatusConflict, errcode.BadRequest, "角色编码已存在")
	case errors.Is(err, service.ErrSystemInvalidPermission):
		response.Fail(c, http.StatusBadRequest, errcode.BadRequest, "含不存在的权限码")
	case errors.Is(err, service.ErrSystemBadRequest):
		response.Fail(c, http.StatusBadRequest, errcode.BadRequest, "参数无效")
	default:
		response.Fail(c, http.StatusInternalServerError, errcode.InternalError, "服务异常")
	}
}

func (h *System) listPermissions(c *gin.Context) {
	out, err := h.svc.ListPermissions(c.Request.Context())
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, errcode.InternalError, "服务异常")
		return
	}
	response.OK(c, out)
}

func (h *System) updateRolePermissions(c *gin.Context) {
	id, ok := parseUint64Param(c, "id")
	if !ok {
		response.Fail(c, http.StatusBadRequest, errcode.BadRequest, "无效的角色 ID")
		return
	}
	var req model.SystemUpdateRolePermissionsReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, http.StatusBadRequest, errcode.BadRequest, "参数错误")
		return
	}
	out, err := h.svc.UpdateRolePermissions(c.Request.Context(), id, req.PermissionCodes)
	switch {
	case err == nil:
		response.OK(c, out)
	case errors.Is(err, service.ErrSystemRoleNotFound):
		response.Fail(c, http.StatusNotFound, errcode.NotFound, "角色不存在")
	case errors.Is(err, service.ErrSystemInvalidPermission):
		response.Fail(c, http.StatusBadRequest, errcode.BadRequest, "含不存在的权限码")
	default:
		response.Fail(c, http.StatusInternalServerError, errcode.InternalError, "服务异常")
	}
}
