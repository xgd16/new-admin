package router

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"new-admin/internal/handler"
	"new-admin/internal/jwtissuer"
	"new-admin/internal/middleware"
	"new-admin/internal/repository"
	"new-admin/internal/service"
)

// robotsTxtBody 与 web-admin/public/robots.txt 策略一致：拒绝遵守规范的爬虫索引。
const robotsTxtBody = "# Admin: disallow indexing\nUser-agent: *\nDisallow: /\n"

type Deps struct {
	Log              *zap.Logger
	AccessLog        *zap.Logger // HTTP 访问日志；可为仅控制台，见 log.access_log_file_enabled
	ServerMode       string
	JWT              *jwtissuer.Issuer
	RBACRepo         *repository.RBAC
	Audit            *service.Audit
	Health           *handler.Health
	Auth             *handler.Auth
	Passkey          *handler.Passkey
	Dash             *handler.Dashboard
	System           *handler.System
	FrontUser        *handler.FrontUser
	CORSAllowOrigins []string
	StaticUploadRoot string
	StaticPublicRoot string
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

	e.GET("/robots.txt", func(c *gin.Context) {
		c.Data(http.StatusOK, "text/plain; charset=utf-8", []byte(robotsTxtBody))
	})

	api := e.Group("/admin/v1")

	public := api.Group("")
	d.Health.RegisterPublic(public)
	d.Auth.RegisterPublic(public)
	if d.Passkey != nil {
		d.Passkey.RegisterPublic(public)
	}

	authed := api.Group("")
	authed.Use(middleware.RequireAuth(d.JWT))
	d.Auth.RegisterAuthed(authed)
	if d.Passkey != nil {
		d.Passkey.RegisterAuthed(authed)
	}

	dashboardGroup := api.Group("/dashboard")
	dashboardGroup.Use(
		middleware.RequireAuth(d.JWT),
		middleware.RequirePermission("dashboard:view", d.RBACRepo, d.Log.Named("middleware")),
	)
	d.Dash.Register(dashboardGroup)

	d.System.Register(api, d.JWT, d.RBACRepo, d.Log.Named("system"))
	d.FrontUser.Register(api, d.JWT, d.RBACRepo, d.Log.Named("front_user"), d.Audit)

	if d.StaticUploadRoot != "" {
		uploads := api.Group("/uploads")
		uploads.Use(middleware.RequireAuth(d.JWT))
		uploads.Static("/", d.StaticUploadRoot)
	}
	if d.StaticPublicRoot != "" {
		publicFiles := e.Group("/public/v1")
		publicFiles.Static("/", d.StaticPublicRoot)
	}

	return e
}
