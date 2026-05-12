package handler

import (
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"new-admin/internal/middleware"
	"new-admin/internal/model"
	"new-admin/internal/service"
	"new-admin/pkg/errcode"
	"new-admin/pkg/response"
)

type Auth struct {
	svc     *service.Auth
	captcha *service.Captcha
}

func NewAuth(svc *service.Auth, captcha *service.Captcha) *Auth {
	return &Auth{svc: svc, captcha: captcha}
}

func (h *Auth) RegisterPublic(rg *gin.RouterGroup) {
	rg.GET("/auth/captcha", h.Captcha)
	rg.POST("/auth/login", h.Login)
}

func (h *Auth) Captcha(c *gin.Context) {
	id, img, err := h.captcha.Generate()
	if err != nil {
		logHandlerErr(c, "captcha_generate", err)
		response.Fail(c, http.StatusInternalServerError, errcode.InternalError, "验证码生成失败")
		return
	}
	response.OK(c, model.CaptchaResp{CaptchaID: id, ImageBase64: img})
}

func (h *Auth) RegisterAuthed(auth *gin.RouterGroup) {
	auth.GET("/auth/me", h.Me)
}

func (h *Auth) Login(c *gin.Context) {
	var req model.LoginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		logBindJSON(c, err)
		response.Fail(c, http.StatusBadRequest, errcode.BadRequest, "参数错误")
		return
	}
	if !h.captcha.Verify(strings.TrimSpace(req.CaptchaID), strings.TrimSpace(req.CaptchaCode), true) {
		response.Fail(c, http.StatusBadRequest, errcode.BadRequest, "验证码错误或已过期")
		return
	}
	meta := service.NormalizeClientMeta(service.ClientMeta{
		IP:        c.ClientIP(),
		UserAgent: c.Request.UserAgent(),
	})
	out, err := h.svc.Login(c.Request.Context(), req.Username, req.Password, meta)
	switch {
	case err == nil:
		response.OK(c, out)
	case errors.Is(err, service.ErrAuthInvalidCred):
		response.Fail(c, http.StatusUnauthorized, errcode.Unauthorized, "用户名或密码错误")
	case errors.Is(err, service.ErrAuthUserDisabled):
		response.Fail(c, http.StatusForbidden, errcode.Forbidden, "账号已禁用")
	default:
		logHandlerErr(c, "auth_login", err)
		response.Fail(c, http.StatusInternalServerError, errcode.InternalError, "服务异常")
	}
}

func (h *Auth) Me(c *gin.Context) {
	uid, ok := middleware.AuthUserID(c)
	if !ok {
		response.Fail(c, http.StatusUnauthorized, errcode.Unauthorized, "未登录")
		return
	}
	me, err := h.svc.Profile(c.Request.Context(), uid)
	switch {
	case err == nil:
		response.OK(c, me)
	case errors.Is(err, service.ErrAuthUserNotFound):
		response.Fail(c, http.StatusNotFound, errcode.NotFound, "用户不存在")
	case errors.Is(err, service.ErrAuthUserDisabled):
		response.Fail(c, http.StatusForbidden, errcode.Forbidden, "账号已禁用")
	default:
		logHandlerErr(c, "auth_profile", err)
		response.Fail(c, http.StatusInternalServerError, errcode.InternalError, "服务异常")
	}
}
