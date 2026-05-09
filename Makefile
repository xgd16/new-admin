.PHONY: run tidy lint test build db-init migrate-up migrate-down migrate-version migrate-force migrate-new build-linux-amd64 build-linux-amd64-all

MIGRATE_STEPS ?= 1

# linux/amd64 产物目录（可覆盖：make build-linux-amd64 LINUX_AMD64_OUT=dist/linux-amd64）
LINUX_AMD64_OUT ?= bin/linux-amd64
# 静态链接常用标签：纯 Go DNS + 嵌入时区数据（精简镜像无 zoneinfo 时更安全）
LINUX_AMD64_TAGS ?= netgo,timetzdata

run:
	go run ./cmd/server

tidy:
	go mod tidy

build:
	go build -o bin/server ./cmd/server

# 交叉编译 linux/amd64：strip 符号、裁剪路径、禁用 CGO（便于静态部署）
build-linux-amd64:
	@mkdir -p $(LINUX_AMD64_OUT)
	env GOOS=linux GOARCH=amd64 CGO_ENABLED=0 \
		go build -trimpath -tags "$(LINUX_AMD64_TAGS)" -ldflags="-s -w" \
			-o $(LINUX_AMD64_OUT)/server ./cmd/server

build-linux-amd64-all: build-linux-amd64

test:
	go test ./...

lint:
	@test -n "$$(command -v golangci-lint)" || (echo 'install golangci-lint: https://golangci-lint.run' && exit 1)
	golangci-lint run ./...

# 使用系统 mysql 客户端创建库（见 scripts/init_mysql.sh）
db-init:
	bash scripts/init_mysql.sh

# 数据库迁移（golang-migrate，读取 configs/config.yaml / NEW_ADMIN_*）
migrate-up:
	go run ./cmd/server migrate up

migrate-down:
	go run ./cmd/server migrate down --steps $(MIGRATE_STEPS)

migrate-version:
	go run ./cmd/server migrate version

migrate-force:
	@test -n "$(VER)" || (echo '用法: make migrate-force VER=1' && exit 1)
	go run ./cmd/server migrate force $(VER)

# 生成新的迁移文件骨架（需已安装 migrate 命令行）
migrate-new:
	@test -n "$(NAME)" || (echo '用法: make migrate-new NAME=add_users_table' && exit 1)
	@command -v migrate >/dev/null 2>&1 || (echo '请先安装: go install -tags \"mysql\" github.com/golang-migrate/migrate/v4/cmd/migrate@latest' && exit 1)
	migrate create -ext sql -dir migrations -seq $(NAME)
