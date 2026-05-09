package handler

import (
	"github.com/gin-gonic/gin"

	"new-admin/internal/service"
	"new-admin/pkg/response"
)

type Health struct {
	svc *service.HealthService
}

func NewHealth(svc *service.HealthService) *Health {
	return &Health{svc: svc}
}

func (h *Health) RegisterPublic(rg *gin.RouterGroup) {
	rg.GET("/health", h.Health)
}

func (h *Health) Health(c *gin.Context) {
	resp := h.svc.Check(c.Request.Context())
	response.OK(c, resp)
}
