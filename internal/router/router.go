package router

import (
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"new-admin/internal/handler"
	"new-admin/internal/jwtissuer"
	"new-admin/internal/middleware"
	"new-admin/internal/repository"
	"new-admin/internal/service"
)

type Deps struct {
	Log              *zap.Logger
	AccessLog        *zap.Logger // HTTP 访问日志；可为仅控制台，见 log.access_log_file_enabled
	ServerMode       string
	JWT              *jwtissuer.Issuer
	RBACRepo         *repository.RBAC
	Audit            *service.Audit
	Health           *handler.Health
	Auth             *handler.Auth
	Dash             *handler.Dashboard
	System           *handler.System
	FrontUser        *handler.FrontUser
	CORSAllowOrigins []string
}

func NewEngine(d Deps) *gin.Engine {
	e := gin.New()
	e.Use(gin.Recovery())
	e.Use(middleware.RequestID())

	access := d.AccessLog
	if access == nil {
		access = d.Log.Named("access").WithOptions(zap.WithCaller(false))
	}
	e.Use(middleware.ZapAccessLog(access))
	e.Use(middleware.CORS(d.CORSAllowOrigins))

	api := e.Group("/admin/v1")

	public := api.Group("")
	d.Health.RegisterPublic(public)
	d.Auth.RegisterPublic(public)

	authed := api.Group("")
	authed.Use(middleware.RequireAuth(d.JWT))
	d.Auth.RegisterAuthed(authed)

	dashboardGroup := api.Group("/dashboard")
	dashboardGroup.Use(
		middleware.RequireAuth(d.JWT),
		middleware.RequirePermission("dashboard:view", d.RBACRepo, d.Log.Named("middleware")),
	)
	d.Dash.Register(dashboardGroup)

	d.System.Register(api, d.JWT, d.RBACRepo, d.Log.Named("system"))
	d.FrontUser.Register(api, d.JWT, d.RBACRepo, d.Log.Named("front_user"), d.Audit)

	return e
}
