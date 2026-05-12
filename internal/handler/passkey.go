package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"new-admin/internal/middleware"
	"new-admin/internal/model"
	"new-admin/internal/service"
	"new-admin/pkg/errcode"
	"new-admin/pkg/response"
)

type Passkey struct {
	svc *service.Passkey
}

func NewPasskey(svc *service.Passkey) *Passkey {
	return &Passkey{svc: svc}
}

func (h *Passkey) RegisterPublic(rg *gin.RouterGroup) {
	rg.POST("/auth/passkey/login/begin", h.LoginBegin)
	rg.POST("/auth/passkey/login/finish", h.LoginFinish)
}

func (h *Passkey) RegisterAuthed(rg *gin.RouterGroup) {
	rg.GET("/auth/passkey/credentials", h.ListCredentials)
	rg.DELETE("/auth/passkey/credentials/:id", h.DeleteCredential)
	rg.POST("/auth/passkey/register/begin", h.RegisterBegin)
	rg.POST("/auth/passkey/register/finish", h.RegisterFinish)
}

func (h *Passkey) ListCredentials(c *gin.Context) {
	if h.svc == nil {
		response.Fail(c, http.StatusServiceUnavailable, errcode.InternalError, "通行密钥未启用")
		return
	}
	uid, ok := middleware.AuthUserID(c)
	if !ok || uid == 0 {
		response.Fail(c, http.StatusUnauthorized, errcode.Unauthorized, "未登录")
		return
	}
	list, err := h.svc.ListCredentialItems(c.Request.Context(), uid)
	if err != nil {
		logHandlerErr(c, "passkey_list_credentials", err)
		response.Fail(c, http.StatusInternalServerError, errcode.InternalError, "无法加载通行密钥列表")
		return
	}
	response.OK(c, model.PasskeyCredentialListResp{List: list})
}

func (h *Passkey) DeleteCredential(c *gin.Context) {
	if h.svc == nil {
		response.Fail(c, http.StatusServiceUnavailable, errcode.InternalError, "通行密钥未启用")
		return
	}
	uid, ok := middleware.AuthUserID(c)
	if !ok || uid == 0 {
		response.Fail(c, http.StatusUnauthorized, errcode.Unauthorized, "未登录")
		return
	}
	idStr := c.Param("id")
	credID, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil || credID == 0 {
		response.Fail(c, http.StatusBadRequest, errcode.BadRequest, "参数错误")
		return
	}
	switch err := h.svc.DeleteCredential(c.Request.Context(), uid, credID); {
	case err == nil:
		response.OK(c, gin.H{"ok": true})
	case errors.Is(err, service.ErrPasskeyCredentialNotFound):
		response.Fail(c, http.StatusNotFound, errcode.NotFound, "操作未能完成，请刷新后重试")
	default:
		logHandlerErr(c, "passkey_delete_credential", err)
		response.Fail(c, http.StatusInternalServerError, errcode.InternalError, "解绑失败")
	}
}

func (h *Passkey) LoginBegin(c *gin.Context) {
	if h.svc == nil {
		response.Fail(c, http.StatusServiceUnavailable, errcode.InternalError, "通行密钥未启用")
		return
	}
	var req model.PasskeyLoginBeginReq
	if err := c.ShouldBindJSON(&req); err != nil {
		logBindJSON(c, err)
		response.Fail(c, http.StatusBadRequest, errcode.BadRequest, "参数错误")
		return
	}
	key, assert, err := h.svc.BeginLogin(c.Request.Context(), req.Username)
	const passkeyBeginVague = "无法使用通行密钥登录，请核对账号或改用密码登录"
	switch {
	case err == nil:
		raw, err := json.Marshal(assert)
		if err != nil {
			logHandlerErr(c, "passkey_login_begin_marshal", err)
			response.Fail(c, http.StatusInternalServerError, errcode.InternalError, "服务异常")
			return
		}
		response.OK(c, model.PasskeyLoginBeginResp{SessionKey: key, Options: raw})
	case errors.Is(err, service.ErrAuthInvalidCred) ||
		errors.Is(err, service.ErrPasskeyNoCredentials) ||
		errors.Is(err, service.ErrAuthUserDisabled):
		// 与「账号是否存在 / 是否绑定 Passkey / 是否禁用」相关的提示统一模糊，降低枚举与推断风险
		response.Fail(c, http.StatusUnauthorized, errcode.Unauthorized, passkeyBeginVague)
	default:
		logHandlerErr(c, "passkey_login_begin", err)
		response.Fail(c, http.StatusInternalServerError, errcode.InternalError, "服务异常")
	}
}

func (h *Passkey) LoginFinish(c *gin.Context) {
	if h.svc == nil {
		response.Fail(c, http.StatusServiceUnavailable, errcode.InternalError, "通行密钥未启用")
		return
	}
	var req model.PasskeyLoginFinishReq
	if err := c.ShouldBindJSON(&req); err != nil {
		logBindJSON(c, err)
		response.Fail(c, http.StatusBadRequest, errcode.BadRequest, "参数错误")
		return
	}
	meta := service.NormalizeClientMeta(service.ClientMeta{
		IP:        c.ClientIP(),
		UserAgent: c.Request.UserAgent(),
	})
	out, err := h.svc.FinishLogin(c.Request.Context(), req.SessionKey, []byte(req.Credential), meta)
	if err != nil {
		// 不区分会话失效、用户状态、断言校验失败等，避免推断账号或绑定情况
		logHandlerErr(c, "passkey_login_finish", err)
		response.Fail(c, http.StatusBadRequest, errcode.BadRequest, "通行密钥验证未通过，请重试或使用密码登录")
		return
	}
	response.OK(c, out)
}

func (h *Passkey) RegisterBegin(c *gin.Context) {
	if h.svc == nil {
		response.Fail(c, http.StatusServiceUnavailable, errcode.InternalError, "通行密钥未启用")
		return
	}
	uid, ok := middleware.AuthUserID(c)
	if !ok || uid == 0 {
		response.Fail(c, http.StatusUnauthorized, errcode.Unauthorized, "未登录")
		return
	}
	key, creation, err := h.svc.BeginRegistration(c.Request.Context(), uid)
	if err != nil {
		logHandlerErr(c, "passkey_register_begin", err)
		response.Fail(c, http.StatusInternalServerError, errcode.InternalError, "无法开始注册")
		return
	}
	raw, err := json.Marshal(creation)
	if err != nil {
		logHandlerErr(c, "passkey_register_begin_marshal", err)
		response.Fail(c, http.StatusInternalServerError, errcode.InternalError, "服务异常")
		return
	}
	response.OK(c, model.PasskeyRegisterBeginResp{SessionKey: key, Options: raw})
}

func (h *Passkey) RegisterFinish(c *gin.Context) {
	if h.svc == nil {
		response.Fail(c, http.StatusServiceUnavailable, errcode.InternalError, "通行密钥未启用")
		return
	}
	uid, ok := middleware.AuthUserID(c)
	if !ok || uid == 0 {
		response.Fail(c, http.StatusUnauthorized, errcode.Unauthorized, "未登录")
		return
	}
	var req model.PasskeyRegisterFinishReq
	if err := c.ShouldBindJSON(&req); err != nil {
		logBindJSON(c, err)
		response.Fail(c, http.StatusBadRequest, errcode.BadRequest, "参数错误")
		return
	}
	if err := h.svc.FinishRegistration(c.Request.Context(), uid, req.SessionKey, []byte(req.Credential)); err != nil {
		logHandlerErr(c, "passkey_register_finish", err)
		response.Fail(c, http.StatusBadRequest, errcode.BadRequest, "操作未能完成，请重试")
		return
	}
	response.OK(c, gin.H{"ok": true})
}
