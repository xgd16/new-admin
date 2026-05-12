# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
make run          # 启动 HTTP 服务
make build        # 编译到 bin/server
make build-linux-amd64  # 交叉编译 linux/amd64（静态链接，CGO_ENABLED=0）
make test         # go test ./...
make lint         # golangci-lint run ./...
make tidy         # go mod tidy

# 数据库迁移
make migrate-up         # 应用全部待执行迁移
make migrate-down       # 回滚 1 步，MIGRATE_STEPS=2 回滚多步
make migrate-version    # 查看当前版本与 dirty 状态
make migrate-force VER=7   # 强制设置版本（修复 dirty，慎用）
make migrate-new NAME=xxx   # 生成新迁移骨架（需安装 migrate CLI）
```

## Architecture

**Layered design with manual DI** — dependencies follow `handler → service → repository` and are wired by hand in `cmd/server/main.go:runServer()` (no wire/fx).

```
cmd/server/main.go     → 组装所有依赖，创建 Gin engine，启动 HTTP
internal/router/       → 路由注册 + 全局中间件；Deps struct 承载所有 handler 依赖
internal/middleware/   → RequestID, AccessLog, CORS, RequireAuth (JWT), RequirePermission
internal/handler/      → 薄层：解析请求 → 调用 service → 用 pkg/response 写响应
internal/service/      → 业务逻辑编排；不引用 gin.Context
internal/repository/   → 数据访问（GORM），构造函数接收 *gorm.DB
internal/store/        → MySQL/Redis 连接建立、migrate URL 组装
internal/config/       → Viper 配置结构与加载
internal/model/        → DTO、领域实体、RBAC 表结构
pkg/errcode/           → 业务错误码常量（0=OK, 4xxxx=客户端, 5xxxx=服务端）
pkg/response/          → 统一 JSON 响应：{code, message, data}
```

## Key patterns

- **Config**: `configs/config.yaml` 为主配置，环境变量 `NEW_ADMIN_` 前缀可覆盖（`.` 替换为 `_`，如 `NEW_ADMIN_SERVER_ADDR`）。配置路径可通过 `NEW_ADMIN_CONFIG` 指定。
- **JWT auth**: `internal/middleware/jwt.go` 从 `Authorization: Bearer <token>` 解析，将 `auth_uid`/`auth_username` 存入 context。Handler 通过 `middleware.AuthUserID(c)` / `middleware.AuthUsername(c)` 读取。
- **RBAC**: `middleware.RequirePermission(perm, rbacRepo, log)` 用于需要特定权限的路由组，需在 `RequireAuth` 之后注册。
- **API prefix**: REST 前缀 `/admin/v1`，内部按认证级别分三组：`public`（无需登录）、`authed`（需 Bearer JWT）、permission-protected（需 JWT + 权限）。
- **Static files**: `static.upload_root` → `/admin/v1/uploads/`（需登录）；`static.public_root` → `/public/v1/`（匿名可访问）。均在 `config.yaml` 配置，空字符串则不挂载。
- **WebAuthn/passkey**: 可选初始化 — 若 `webauthn.New()` 失败，只 warn 日志并跳过 passkey handler，不阻塞启动。
- **Database**: 表结构以 `migrations/` 中的 SQL 为准，禁止用 GORM `AutoMigrate` 管理线上结构。迁移 URL 含 `multiStatements=true`，单文件可写多条 SQL。
- **Logging**: zap 双通道 — 业务日志（`zapLog`）+ HTTP 访问日志（`accessLog`）。生产模式输出 JSON，可配置按级别拆分文件（error 单独落盘）、大小轮转与压缩。
