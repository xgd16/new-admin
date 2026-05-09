# new-admin

企业级后台风格的 **Go + Gin** API 服务，配套 **React（Vite + TypeScript）** 管理端前端 `web-admin`。REST 前缀为 **`/admin/v1`**，配置基于 **Viper**，日志 **zap**，数据访问 **GORM + MySQL**，缓存 **Redis**；数据库结构由 **golang-migrate** 版本化管理。

更完整的分层约定与协作说明见 [AGENTS.md](./AGENTS.md)。

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 运行时 | Go 1.24+ |
| Web | Gin |
| CLI | [Cobra](https://github.com/spf13/cobra) |
| 配置 | Viper（`NEW_ADMIN_` 前缀的环境变量可覆盖 YAML） |
| 日志 | zap + lumberjack 轮转 |
| 数据库 | MySQL 8.x（驱动：`go-sql-driver`）、golang-migrate |
| 缓存 | Redis（go-redis v9） |
| 鉴权 | JWT |
| 管理端 | React 19、Vite 8、TypeScript、HeroUI、Tailwind CSS 4 |

---

## 环境要求

- **Go**：版本不低于 `go.mod` 中的要求。
- **MySQL**：本地或远端实例；默认库名见配置文件（常为 `new_admin`）。
- **Redis**：与配置中的 `redis.addr` 一致。
- **前端开发**（可选）：Node.js，建议在 `web-admin` 下使用 npm。

---

## 快速开始

### 1. 克隆与依赖

```bash
git clone <仓库地址> new-admin
cd new-admin
go mod download
```

### 2. 配置

- 默认配置文件：`configs/config.yaml`。
- 可通过 **`NEW_ADMIN_CONFIG`** 指定其它配置文件路径。
- 敏感项（数据库密码、Redis 密码、`jwt.secret` 等）建议在生产环境用 **`NEW_ADMIN_*`** 注入，勿向仓库提交真实密钥。
- 环境变量示例见 [.env.example](./.env.example)。

### 3. 创建数据库（可选）

本机已安装 `mysql` 客户端时：

```bash
make db-init
```

也可手动创建与配置一致的库（字符集建议 `utf8mb4`）。

### 4. 迁移表结构

```bash
make migrate-up
```

查看版本：`make migrate-version`。其余迁移命令见下文「命令行」。

### 5. 启动 API

```bash
make run
# 或
go run ./cmd/server
```

默认监听地址见 `configs/config.yaml` 中 `server.addr`（常为 `:8080`）。

### 6. 启动管理端（可选）

```bash
cd web-admin
npm install
npm run dev
```

按需修改前端环境中的后端 API 地址；浏览器直连后端时，请将前端 Origin 配入 **`cors.allowed_origins`**（默认包含 `http://localhost:5173`）。

---

## 命令行

入口为 **`cmd/server`**：无子命令时启动 HTTP；迁移通过 **`migrate`** 子命令完成。

```bash
go run ./cmd/server migrate up
go run ./cmd/server migrate down --steps 1
go run ./cmd/server migrate version
go run ./cmd/server migrate force <版本号>   # 慎用：修正 dirty
go run ./cmd/server migrate --path migrations --help
```

与 Makefile 对应关系：`make migrate-up` / `migrate-down` / `migrate-version` / `migrate-force` 均调用上述命令。

新建迁移 SQL 骨架仍可使用官方 **`migrate` CLI**（见 `make migrate-new` 提示）。

---

## Makefile 常用目标

| 目标 | 说明 |
|------|------|
| `make run` | 启动 HTTP 服务 |
| `make build` | 编译到 `bin/server` |
| `make test` | 运行 `go test ./...` |
| `make lint` | golangci-lint（需本机已安装） |
| `make tidy` | `go mod tidy` |
| `make db-init` | 使用脚本创建 MySQL 库 |
| `make migrate-up` / `migrate-down` / `migrate-version` / `migrate-force` | 数据库迁移 |
| `make build-linux-amd64` | 交叉编译 linux/amd64 至 `LINUX_AMD64_OUT`（默认 `bin/linux-amd64/server`） |

---

## 仓库结构（概要）

```
cmd/server/          # 进程入口：HTTP + Cobra（migrate 子命令）
configs/             # 默认配置
internal/            # 配置、路由、中间件、handler、service、repository、store 等
migrations/          # SQL 迁移（up/down）
pkg/                 # 对外可复用的 errcode、response 等
web-admin/           # 管理端前端
```

详细分层与禁止事项见 [AGENTS.md](./AGENTS.md)。

---

## 测试与代码质量

```bash
make test
make lint
```

---

## 安全说明

- 仓库内的示例密码、JWT secret **仅用于本地开发**，上线前务必替换并通过环境变量管理。
- 迁移 **000002** 若包含默认管理员账号，仅限开发环境验证；生产环境请修改密码与权限策略。
- 不要将 `.env`、私有密钥或业务日志提交到 Git（参见 [.gitignore](./.gitignore)）。
