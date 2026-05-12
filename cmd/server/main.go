// Package main 为 new-admin 进程入口：通过 Cobra 解析 CLI（默认启动 Gin HTTP），
// 子命令 migrate 独立执行数据库迁移，二者共用 configs/config.yaml（或 NEW_ADMIN_CONFIG）。
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-webauthn/webauthn/protocol"
	"github.com/go-webauthn/webauthn/webauthn"
	"go.uber.org/zap"

	"new-admin/internal/config"
	"new-admin/internal/handler"
	"new-admin/internal/jwtissuer"
	"new-admin/internal/logger"
	"new-admin/internal/repository"
	"new-admin/internal/router"
	"new-admin/internal/service"
	"new-admin/internal/store"
)

// configPath 返回配置文件路径；优先环境变量 NEW_ADMIN_CONFIG，否则默认 configs/config.yaml。
func configPath() string {
	if p := os.Getenv("NEW_ADMIN_CONFIG"); p != "" {
		return p
	}
	return filepath.Join("configs", "config.yaml")
}

// main 将命令行交给 Cobra 解析；migrate 等子命令失败时进程以非零码退出。
func main() {
	if err := execute(); err != nil {
		os.Exit(1)
	}
}

// runServer 加载配置、初始化 MySQL/Redis、日志与领域依赖，组装 Gin 引擎并监听；
// 收到 SIGINT/SIGTERM 后在超时内优雅关闭 HTTP 服务。
func runServer() {
	cfg, err := config.Load(configPath())
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	// MySQL（GORM），由 repository 使用；关闭底层连接在进程退出时执行。
	db, err := store.OpenMySQL(cfg.MySQL)
	if err != nil {
		log.Fatalf("mysql: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("mysql sql db: %v", err)
	}
	defer sqlDB.Close()

	// Redis 客户端（用途见 health check、缓存等业务）。
	rdb, err := store.OpenRedis(cfg.Redis)
	if err != nil {
		log.Fatalf("redis: %v", err)
	}
	defer func() { _ = rdb.Close() }()

	zapLog, accessLog, closeLog, err := logger.New(cfg.Log, cfg.Server.Mode)
	if err != nil {
		log.Fatalf("logger: %v", err)
	}
	defer func() {
		_ = zapLog.Sync()    //nolint:errcheck
		_ = accessLog.Sync() //nolint:errcheck
		closeLog()
	}()

	gin.SetMode(cfg.Server.Mode)

	// 以下为 HTTP 层依赖装配：repository → service → handler → router
	jwtTTL := time.Duration(cfg.JWT.AccessTTLMin) * time.Minute
	jwtIss, err := jwtissuer.New(cfg.JWT.Secret, jwtTTL, "new-admin")
	if err != nil {
		log.Fatalf("jwt: %v", err)
	}

	userRepo := repository.NewUser(db)
	rbacRepo := repository.NewRBAC(db)
	frontUserRepo := repository.NewFrontUser(db)
	adminOpLogRepo := repository.NewAdminOpLog(db)
	auditSvc := service.NewAudit(adminOpLogRepo, zapLog)
	authSvc := service.NewAuth(zapLog.Named("svc"), jwtIss, userRepo, rbacRepo, jwtTTL, auditSvc)
	captchaSvc := service.NewCaptcha()
	authH := handler.NewAuth(authSvc, captchaSvc)

	var passkeySvc *service.Passkey
	wa, waErr := webauthn.New(&webauthn.Config{
		RPDisplayName: cfg.WebAuthn.RPDisplayName,
		RPID:          cfg.WebAuthn.RPID,
		RPOrigins:     cfg.WebAuthn.Origins,
		AuthenticatorSelection: protocol.AuthenticatorSelection{
			UserVerification: protocol.VerificationPreferred,
			ResidentKey:      protocol.ResidentKeyRequirementPreferred,
		},
	})
	if waErr != nil {
		zapLog.Warn("webauthn_disabled", zap.String("reason", waErr.Error()))
	} else {
		webauthnCredRepo := repository.NewWebauthnCred(db)
		passkeySess := service.NewPasskeySessionStore(rdb)
		passkeySvc = service.NewPasskey(wa, passkeySess, userRepo, webauthnCredRepo, authSvc)
	}
	passkeyH := handler.NewPasskey(passkeySvc)
	systemSvc := service.NewSystem(userRepo, rbacRepo)
	systemH := handler.NewSystem(systemSvc, auditSvc)
	frontUserSvc := service.NewFrontUser(frontUserRepo)
	frontUserH := handler.NewFrontUser(frontUserSvc)
	dashSvc := service.NewDashboard(userRepo, rbacRepo, frontUserRepo)
	dashH := handler.NewDashboard(dashSvc)

	healthSvc := service.NewHealthService(db, rdb)
	healthH := handler.NewHealth(healthSvc)
	engine := router.NewEngine(router.Deps{
		Log:              zapLog,
		AccessLog:        accessLog,
		ServerMode:       cfg.Server.Mode,
		JWT:              jwtIss,
		RBACRepo:         rbacRepo,
		Audit:            auditSvc,
		Health:           healthH,
		Auth:             authH,
		Passkey:          passkeyH,
		Dash:             dashH,
		System:           systemH,
		FrontUser:        frontUserH,
		CORSAllowOrigins: cfg.CORS.AllowedOrigins,
		StaticUploadRoot: cfg.Static.UploadRoot,
		StaticPublicRoot: cfg.Static.PublicRoot,
	})

	srv := &http.Server{
		Addr:         cfg.Server.Addr,
		Handler:      engine,
		ReadTimeout:  time.Duration(cfg.Server.ReadTimeoutSec) * time.Second,
		WriteTimeout: time.Duration(cfg.Server.WriteTimeoutSec) * time.Second,
	}

	// 异步监听；优雅退出路径上会 Shutdown，此时返回 ErrServerClosed 属正常。
	go func() {
		zapLog.Info("server_listen", zap.String("addr", cfg.Server.Addr))
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			zapLog.Fatal("listen", zap.String("error", err.Error()))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	// 优雅退出：给进行中的请求最多 10s 收尾
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		zapLog.Error("server_shutdown", zap.String("error", err.Error()))
	}
	zapLog.Info("server_stopped")
}
