# new-admin — AI 协作指引

本文档面向在本仓库内协助开发的 AI 与人类开发者，约定分层、命名与扩展方式。**新增或修改代码时请遵守下列约束**，以保持与企业级 Go/Gin 实践一致。

## 技术栈与模块

- **语言**: Go（版本以 `go.mod` 中 `go` directive 为准）
- **Web**: [Gin](https://github.com/gin-gonic/gin)
- **CLI**: [Cobra](https://github.com/spf13/cobra)（无子命令启动 HTTP，`migrate` 子命令执行迁移）
- **配置**: Viper（`configs/config.yaml`，环境变量前缀 `NEW_ADMIN_`，嵌套键用下划线，如 `NEW_ADMIN_SERVER_ADDR`）
- **日志**: zap（开发模式彩色控制台；生产 JSON）；HTTP 访问日志可与业务日志拆分（见 `internal/logger`）
- **模块路径**: `new-admin`（发布前可按实际域名替换 `go.mod` 中的 module）

## 目录职责（严格分层）

| 路径 | 职责 |
|------|------|
| `cmd/server` | 进程入口：默认启动 Gin HTTP、`migrate` 数据库迁移；依赖装配见 `runServer()` |
| `internal/config` | 配置结构与加载 |
| `internal/router` | 注册路由、全局中间件；**不写业务逻辑**；`Deps` 聚合注入 handler 与基础设施 |
| `internal/middleware` | HTTP 中间件：RequestID、Recovery、访问日志、CORS、JWT、`RequirePermission`、鉴权写审计等 |
| `internal/handler` | **薄**：解析请求、校验入参、调用 service、用 `pkg/response` 写响应 |
| `internal/service` | **业务逻辑**、事务编排、领域规则；可调用 `repository`；**不写** `gin.Context` |
| `internal/store` | 基础设施：MySQL（GORM）、Redis、golang-migrate 连接 URL 组装 |
| `internal/repository` | **数据访问**（封装 GORM）；构造函数接收 `*gorm.DB`；**禁止**被 handler 直接引用 |
| `internal/jwtissuer` | JWT 签发与校验封装（通过注入的 `*jwtissuer.Issuer` 使用） |
| `internal/logger` | zap 初始化、日志轮转、`InstallGinPrettyConsole`（debug + TTY 时对 Gin 路由注册输出着色；尊重 `NO_COLOR`） |
| `internal/model` | DTO、领域实体、RBAC 等与持久化相关的结构定义 |
| `migrations/` | 版本化 SQL：`NNNNNN_name.up.sql` / `.down.sql` |
| `pkg/errcode` | 业务错误码常量 |
| `pkg/response` | 统一 JSON：`code` / `message` / `data` |
| `pkg/xlsx` | Excel 导出等 HTTP 辅助（如操作日志导出） |
| `configs/` | 默认配置文件 |
| `web-admin/` | 管理端前端（Vite + React + TypeScript）；类型可与后端 DTO 对齐 |

依赖方向：**handler → service → repository**；`pkg/*` 可被任意层引用；`internal/*` 不对仓库外导出。

## API 约定

- 对外 REST 前缀：`/admin/v1`（在 `internal/router` 中维护）。
- 根路径另有 `GET /robots.txt`（禁止爬虫索引后台），与 `web-admin/public/robots.txt` 策略一致。
- 成功响应：`pkg/response.OK`，HTTP 200，`code` 为 `errcode.OK`（0）。
- 失败响应：`pkg/response.Fail`，HTTP 状态与 REST 语义一致（如 400/401/404/500），`code` 使用 `pkg/errcode` 中业务码。
- 请求链路：`X-Request-ID` 透传或自动生成，日志字段中带 `request_id`。

### 路由分组与鉴权（概要）

- **public**：健康检查、登录/验证码、WebAuthn 注册/断言等匿名接口。
- **authed**：需 `Authorization: Bearer <token>`；由 `middleware.RequireAuth` 注入 `auth_uid` / `auth_username`。
- **permission**：在 JWT 之上叠加 `middleware.RequirePermission("<perm>", rbacRepo, log)`；权限字符串需与数据库中的权限编码一致。
- **示例权限**（实现以路由为准）：`dashboard:view`、`system:user:read`、`system:user:write`、`system:role:read`、`system:role:write`、`system:audit:read`、`front:user:read`、`front:user:write`。

Handler 读取登录用户：`middleware.AuthUserID(c)`、`middleware.AuthUsername(c)`。

### 审计写操作

`middleware.AuditAuthenticatedWrites` 在 `RequireAuth` 之后挂载：对已通过鉴权的 **非 GET/HEAD/OPTIONS** 请求，在请求完成后写入管理操作日志（详见 `internal/middleware/audit.go` 与 `internal/service/audit.go`）。新增需审计的后台写接口时，顺序保持：**先 RequireAuth，再 AuditAuthenticatedWrites**。

## 新增一个业务功能的推荐步骤

1. **模型/DTO**：在 `internal/model`（若尚无目录则新建）定义请求体、响应体与领域实体；区分「对外 JSON」与「持久化结构」。
2. **repository**：在 `internal/repository` 实现增删改查；构造函数接收 `*gorm.DB` 或 sql 接口（接入 ORM 后统一注入）。
3. **service**：编排 repository，返回 `(data, error)` 或自定义业务错误类型；**不写** `gin.Context`。
4. **handler**：绑定路由、bind JSON/query、调用 service，根据错误映射 HTTP 状态与 `errcode`，调用 `response.OK` / `response.Fail`。
5. **router**：将 handler 注册到合适的分组（public / authed / 带 `RequirePermission` 的子组）；若在 `router.Deps` 中新增依赖，同步扩展结构体与 `main` 装配。
6. **main**：在 `cmd/server/main.go` 的 `runServer()` 中 **wire** 依赖（当前为手动构造，未使用 wire/fx）。

涉及 Excel 导出等可复用输出时，优先复用 `pkg/xlsx`。

## 配置与运行

- 默认配置文件：`configs/config.yaml`。
- 可通过环境变量 `NEW_ADMIN_CONFIG` 指定配置文件绝对或相对路径。
- **Server**：`server.mode` 影响 Gin 模式（如 `debug` / `release`）；`server.addr`、读写超时等见 `internal/config`。
- **Gin debug 控制台**：`server.mode=debug` 且 stdout 为终端、未设置 `NO_COLOR` 时，路由注册日志会着色（`logger.InstallGinPrettyConsole`）。
- MySQL：`mysql.*`，DSN 含 `parseTime=True`、`charset`（默认 utf8mb4）。默认库名 `new_admin`（可用 `NEW_ADMIN_MYSQL_DBNAME` 覆盖）；一键建库：`make db-init`（调用 `scripts/init_mysql.sh`，需本机已安装 `mysql` 客户端）。
- Redis：`redis.addr`、`redis.password`、`redis.db`。密码可用 `NEW_ADMIN_REDIS_PASSWORD` 覆盖；WebAuthn 会话等可选用 Redis。
- **CORS**：`cors.allowed_origins`；本地 Vite 开发前端时需包含前端 Origin（如 `http://localhost:5173`）。
- **静态资源**：`static.upload_root`（登录后可访问 `/admin/v1/uploads/`）、`static.public_root`（`/public/v1/`）；空字符串则不挂载。
- **WebAuthn**：配置合法时启用 passkey；`webauthn.New()` 失败则仅告警并跳过相关 handler，不阻塞启动。
- **安全**：公开仓库勿提交真实密码；生产环境用环境变量覆盖 `mysql.password` / `redis.password`、`jwt.secret` 等。
- 本地运行：`make run` 或 `go run ./cmd/server`。
- **优雅退出**：进程监听 `SIGINT`/`SIGTERM`，在超时内 `http.Server.Shutdown`（当前约 10s），见 `runServer()`。
- 示例环境变量见 `.env.example`。

## 管理端前端 `web-admin`

- 技术栈与启动步骤见仓库根目录 [README.md](./README.md)。
- 本地开发：`cd web-admin && npm install && npm run dev`。
- 接口类型：可维护 `web-admin/src/api/types.ts` 与后端 DTO 一致，减少字段漂移。

## 数据库迁移（[golang-migrate](https://github.com/golang-migrate/migrate)）

- **文件**：`migrations/` 下成对的 `*_*.up.sql` / `*_*.down.sql`；已通过首期 `000001_init` 验证管线。
- **配置**：与主程序一致（默认 `configs/config.yaml`，前缀 `NEW_ADMIN_`）；迁移使用的 URL 由 `internal/store.MySQLMigrateURL` 生成（含 `multiStatements=true`，可在单个文件中执行多条语句）。
- **常用命令**（在项目根目录）：
  - `make migrate-up` — 应用全部待执行迁移（等价 `go run ./cmd/server migrate up`）
  - `make migrate-down` — 默认回滚 1 步；`make migrate-down MIGRATE_STEPS=2` 回滚多步
  - `make migrate-version` — 当前版本与 `dirty` 状态
  - `make migrate-force VER=7` — **慎用**：修正迁移 dirty（先查清事故原因再执行）
- **新建迁移文件**：安装官方 CLI 后 `make migrate-new NAME=xxx`（或 `go install -tags "mysql" github.com/golang-migrate/migrate/v4/cmd/migrate@latest` 后执行 `migrate create -ext sql -dir migrations -seq xxx`）。
- **上线顺序**：先发兼容的旧代码 → `migrate-up` → 再发依赖新结构的服务（或按需灰度）；涉及删列/改语义时需多分阶段迁移。
- **与 GORM**：表结构以迁移 SQL 为准；避免在线上依赖 `AutoMigrate` 代替版本管理。

## 编码风格

- Handler 方法命名与路由语义一致（如 `CreateUser`、`ListOrders`）。
- 错误向上传递，在 handler 一层做 HTTP 与业务码映射。
- 禁止在 handler/repository 写复杂业务分支；复杂逻辑归 service。
- 日志使用结构化字段（`zap.String`、`zap.Int` 等），敏感信息勿打日志。

## Cursor / 规则文件（可选）

若需更强的编辑器约束，可在 `.cursor/rules` 下增加与本文件一致的简短规则，或将本文件路径列为 Agent 必读上下文。

---

**变更项目结构或分层规则时，请同步更新本文件。**
