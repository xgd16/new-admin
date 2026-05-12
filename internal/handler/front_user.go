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
)

type FrontUser struct {
	svc *service.FrontUser
}

func NewFrontUser(svc *service.FrontUser) *FrontUser {
	return &FrontUser{svc: svc}
}

func (h *FrontUser) Register(r *gin.RouterGroup, jwt *jwtissuer.Issuer, rbac *repository.RBAC, log *zap.Logger, audit *service.Audit) {
	g := r.Group("/front/users")
	g.Use(middleware.RequireAuth(jwt))
	g.Use(middleware.AuditAuthenticatedWrites(audit))
	g.GET("", middleware.RequirePermission("front:user:read", rbac, log), h.list)
	g.GET("/:id", middleware.RequirePermission("front:user:read", rbac, log), h.get)
	g.POST("", middleware.RequirePermission("front:user:write", rbac, log), h.create)
	g.PATCH("/:id", middleware.RequirePermission("front:user:write", rbac, log), h.update)
}

func parseFrontQueryInt(c *gin.Context, key string, def int) int {
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

func parseFrontUint64Param(c *gin.Context, key string) (uint64, bool) {
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

func parseFrontUserListParams(c *gin.Context) (*model.FrontUserListParams, bool) {
	p := &model.FrontUserListParams{
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
	p.CreatedFrom = from
	p.CreatedTo = to
	return p, true
}

func (h *FrontUser) list(c *gin.Context) {
	params, ok := parseFrontUserListParams(c)
	if !ok {
		response.Fail(c, http.StatusBadRequest, errcode.BadRequest, "筛选参数无效（请检查状态与日期格式 YYYY-MM-DD）")
		return
	}
	out, err := h.svc.List(
		c.Request.Context(),
		parseFrontQueryInt(c, "page", 1),
		parseFrontQueryInt(c, "page_size", 20),
		params,
	)
	if err != nil {
		logHandlerErr(c, "front_user_list", err)
		response.Fail(c, http.StatusInternalServerError, errcode.InternalError, "服务异常")
		return
	}
	response.OK(c, out)
}

func (h *FrontUser) get(c *gin.Context) {
	id, ok := parseFrontUint64Param(c, "id")
	if !ok {
		response.Fail(c, http.StatusBadRequest, errcode.BadRequest, "无效的前台用户 ID")
		return
	}
	out, err := h.svc.Get(c.Request.Context(), id)
	switch {
	case err == nil:
		response.OK(c, out)
	case errors.Is(err, service.ErrFrontUserNotFound):
		response.Fail(c, http.StatusNotFound, errcode.NotFound, "前台用户不存在")
	default:
		logHandlerErr(c, "front_user_get", err)
		response.Fail(c, http.StatusInternalServerError, errcode.InternalError, "服务异常")
	}
}

func (h *FrontUser) create(c *gin.Context) {
	var req model.FrontUserCreateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		logBindJSON(c, err)
		response.Fail(c, http.StatusBadRequest, errcode.BadRequest, "参数错误")
		return
	}
	out, err := h.svc.Create(c.Request.Context(), &req)
	h.writeMutationResult(c, out, err)
}

func (h *FrontUser) update(c *gin.Context) {
	id, ok := parseFrontUint64Param(c, "id")
	if !ok {
		response.Fail(c, http.StatusBadRequest, errcode.BadRequest, "无效的前台用户 ID")
		return
	}
	var req model.FrontUserUpdateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		logBindJSON(c, err)
		response.Fail(c, http.StatusBadRequest, errcode.BadRequest, "参数错误")
		return
	}
	out, err := h.svc.Update(c.Request.Context(), id, &req)
	h.writeMutationResult(c, out, err)
}

func (h *FrontUser) writeMutationResult(c *gin.Context, out *model.FrontUserDetailResp, err error) {
	switch {
	case err == nil:
		response.OK(c, out)
	case errors.Is(err, service.ErrFrontUserNotFound):
		response.Fail(c, http.StatusNotFound, errcode.NotFound, "前台用户不存在")
	case errors.Is(err, service.ErrFrontUserDuplicateUsername):
		response.Fail(c, http.StatusConflict, errcode.BadRequest, "用户名已存在")
	case errors.Is(err, service.ErrFrontUserDuplicateMobile):
		response.Fail(c, http.StatusConflict, errcode.BadRequest, "手机号已存在")
	case errors.Is(err, service.ErrFrontUserDuplicateEmail):
		response.Fail(c, http.StatusConflict, errcode.BadRequest, "邮箱已存在")
	case errors.Is(err, service.ErrFrontUserBadRequest):
		response.Fail(c, http.StatusBadRequest, errcode.BadRequest, "参数无效")
	default:
		logHandlerErr(c, "front_user_mutation", err)
		response.Fail(c, http.StatusInternalServerError, errcode.InternalError, "服务异常")
	}
}
