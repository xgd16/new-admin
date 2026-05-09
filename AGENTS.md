# new-admin — AI 协作指引

本文档面向在本仓库内协助开发的 AI 与人类开发者，约定分层、命名与扩展方式。**新增或修改代码时请遵守下列约束**，以保持与企业级 Go/Gin 实践一致。

## 技术栈与模块

- **语言**: Go（版本见 `go.mod`）
- **Web**: [Gin](https://github.com/gin-gonic/gin)
- **配置**: Viper（`configs/config.yaml`，环境变量前缀 `NEW_ADMIN_`，嵌套键用下划线，如 `NEW_ADMIN_SERVER_ADDR`）
- **日志**: zap（开发模式彩色控制台；生产 JSON）
- **模块路径**: `new-admin`（发布前可按实际域名替换 `go.mod` 中的 module）

## 目录职责（严格分层）

| 路径 | 职责 |
|------|------|
| `cmd/server` | 进程入口：[Cobra](https://github.com/spf13/cobra) 子命令（默认启动 HTTP）、`migrate` 数据库迁移；配置见 `internal/config` |
| `internal/config` | 配置结构与加载 |
| `internal/router` | 注册路由、全局中间件；**不写业务逻辑** |
| `internal/middleware` | HTTP 中间件（鉴权、限流等） |
| `internal/handler` | **薄**：解析请求、校验入参、调用 service、用 `pkg/response` 写响应 |
| `internal/service` | **业务逻辑**、事务编排、领域规则；可调用 `repository` |
| `internal/store` | 基础设施：MySQL（GORM）、Redis、golang-migrate 连接 URL 组装 |
| `internal/repository` | **数据访问**（封装 GORM/SQL）；构造函数接收 `*gorm.DB`；**禁止**被 handler 直接引用 |
| `migrations/` | 版本化 SQL：`NNNNNN_name.up.sql` / `.down.sql` |
| `pkg/errcode` | 业务错误码常量 |
| `pkg/response` | 统一 JSON：`code` / `message` / `data` |
| `configs/` | 默认配置文件 |

依赖方向：**handler → service → repository**；`pkg/*` 可被任意层引用；`internal/*` 不对仓库外导出。

## API 约定

- 对外 REST 前缀：`/admin/v1`（在 `internal/router` 中维护）。
- 成功响应：`pkg/response.OK`，HTTP 200，`code` 为 `errcode.OK`（0）。
- 失败响应：`pkg/response.Fail`，HTTP 状态与 REST 语义一致（如 400/401/404/500），`code` 使用 `pkg/errcode` 中业务码。
- 请求链路：`X-Request-ID` 透传或自动生成，日志字段中带 `request_id`。

## 新增一个业务功能的推荐步骤

1. **模型/DTO**：在 `internal/model`（若尚无目录则新建）定义请求体、响应体与领域实体；区分「对外 JSON」与「持久化结构」。
2. **repository**：在 `internal/repository` 实现增删改查；构造函数接收 `*gorm.DB` 或 sql 接口（接入 ORM 后统一注入）。
3. **service**：编排 repository，返回 `(data, error)` 或自定义业务错误类型；**不写** `gin.Context`。
4. **handler**：绑定路由、bind JSON/query、调用 service，根据错误映射 HTTP 状态与 `errcode`，调用 `response.OK` / `response.Fail`。
5. **router**：将 handler 注册到合适的 `RouterGroup`（如 `auth` / `public`）。
6. **main**：在 `cmd/server/main.go` 中 **wire** 依赖（手动构造或后续引入 fx/wire）。

## 配置与运行

- 默认配置文件：`configs/config.yaml`。
- 可通过环境变量 `NEW_ADMIN_CONFIG` 指定配置文件绝对或相对路径。
- MySQL：`mysql.*`，DSN 含 `parseTime=True`、`charset`（默认 utf8mb4）。默认库名 `new_admin`（可用 `NEW_ADMIN_MYSQL_DBNAME` 覆盖）；一键建库：`make db-init`（调用 `scripts/init_mysql.sh`，需本机已安装 `mysql` 客户端）。
- Redis：`redis.addr`、`redis.password`、`redis.db`。密码可用 `NEW_ADMIN_REDIS_PASSWORD` 覆盖。
- **安全**：公开仓库勿提交真实密码；生产环境用环境变量覆盖 `mysql.password` / `redis.password`。
- 本地运行：`make run` 或 `go run ./cmd/server`。
- 示例环境变量见 `.env.example`。

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
