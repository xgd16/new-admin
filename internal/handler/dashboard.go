package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"new-admin/internal/service"
	"new-admin/pkg/errcode"
	"new-admin/pkg/response"
)

type Dashboard struct {
	svc *service.Dashboard
}

func NewDashboard(svc *service.Dashboard) *Dashboard {
	return &Dashboard{svc: svc}
}

func (h *Dashboard) Register(authedDash *gin.RouterGroup) {
	authedDash.GET("/overview", h.Overview)
}

func (h *Dashboard) Overview(c *gin.Context) {
	data, err := h.svc.Overview(c.Request.Context())
	if err != nil {
		response.Fail(c, http.StatusInternalServerError, errcode.InternalError, "加载控制台数据失败")
		return
	}
	response.OK(c, data)
}
