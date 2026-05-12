# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
make run                   # 启动 HTTP 服务
make build                 # 编译到 bin/server
make build-linux-amd64     # 交叉编译 linux/amd64（CGO_ENABLED=0，trimpath；默认 bin/linux-amd64/server）
make test                  # go test ./...
make lint                  # golangci-lint run ./...（需本机已安装）
make tidy                  # go mod tidy
make db-init               # scripts/init_mysql.sh 创建库（需 mysql 客户端）

# 数据库迁移（go run ./cmd/server migrate …）
make migrate-up            # 应用全部待执行迁移
make migrate-down          # 回滚 1 步；MIGRATE_STEPS=2 回滚多步
make migrate-version       # 当前版本与 dirty
make migrate-force VER=7   # 强制版本（慎用）
make migrate-new NAME=xxx  # 新迁移骨架（需 migrate CLI）

go run ./cmd/server migrate --path migrations --help
```

## Architecture

**Layered design with manual DI** — `handler → service → repository`, wired in `cmd/server/main.go` → `runServer()` (no wire/fx). SIGINT/SIGTERM 触发带超时的 `Shutdown`（约 10s）。

```
cmd/server/main.go     → 配置；MySQL/Redis；日志；JWT/WebAuthn；组装 router.Deps；优雅退出
internal/router/       → Gin：全局中间件 + /admin/v1；Deps 承载全部 handler
internal/middleware/   → RequestID, ZapRecovery, AppLogger, ZapAccessLog, CORS,
                         RequireAuth(JWT), RequirePermission, AuditAuthenticatedWrites
internal/handler/      → 薄层；System/FrontUser 等路由组在 RequireAuth 后挂审计中间件
internal/service/      → Auth（含验证码）、Passkey、System、FrontUser、Dashboard、Health、Audit 等
internal/repository/   → GORM；*gorm.DB 注入
internal/store/        → MySQL/Redis、migrate URL
internal/config/       → Viper
internal/model/        → DTO、RBAC、操作日志等
internal/jwtissuer/    → JWT 签发与校验
internal/logger/       → 双通道日志；debug+TTY 下 Gin 路由注册着色（NO_COLOR 关闭）
pkg/errcode/           → 0=OK, 4xxxx 客户端, 5xxxx 服务端
pkg/response/          → {code, message, data}
pkg/xlsx/              → Excel 导出（如操作日志）
```

## Key patterns

- **Go version**: Follow `go.mod` `go` directive (keep README tech table aligned).
- **Config**: `configs/config.yaml`；`NEW_ADMIN_` 覆盖（`.` → `_`）；`NEW_ADMIN_CONFIG` 指定路径。
- **Gin**: `gin.SetMode(cfg.Server.Mode)`；debug + TTY 下 `logger.InstallGinPrettyConsole` 着色路由输出。
- **JWT**: `Authorization: Bearer <token>`；`internal/middleware/jwt.go` → context `auth_uid` / `auth_username`；`middleware.AuthUserID` / `AuthUsername`。
- **RBAC**: `RequirePermission(perm, rbacRepo, log)` 在 `RequireAuth` 之后；perms 与 DB 一致（如 `dashboard:view`、`system:user:write`、`front:user:read`）。
- **Audit**: `AuditAuthenticatedWrites(audit)` 记录鉴权后的非 GET/HEAD/OPTIONS 写操作。
- **API**: 前缀 `/admin/v1`；`GET /robots.txt`；public → authed → per-route permission。
- **Static files**: `static.upload_root` → `/admin/v1/uploads/`（登录）；`static.public_root` → `/public/v1/`；空则不挂载。
- **WebAuthn**: 可选；`webauthn.New()` 失败则 warn 并跳过 passkey，不阻塞启动。
- **Database**: `migrations/*.sql` 为准；不用 `AutoMigrate` 管线上；DSN `multiStatements=true`。
- **Logging**: zap 业务 + access；生产 JSON；敏感信息勿记录。
- **Frontend**: `web-admin` — `npm run dev`；CORS `cors.allowed_origins` 需含前端 Origin。

## Domain wiring (quick ref)

`runServer()`：user/rbac/front_user/admin_op_log repos → `Audit` → `Auth`（JWT + captcha）→ System / FrontUser / Dashboard / Health / Passkey（可选）。

---

See [AGENTS.md](./AGENTS.md) for Chinese-first conventions; update both files when layering or router rules change.
