# Clash Config Store — 常用构建与测试入口

BACKEND_DIR  := backend
FRONTEND_DIR := frontend
BINARY       := clash-config-store
LDFLAGS_REL  := -s -w

.PHONY: help backend-build backend-build-debug backend-test backend-tidy backend-run \
	frontend-install frontend-build frontend-test test clean docker-build

help:
	@echo "用法: make <目标>"
	@echo ""
	@echo "后端:"
	@echo "  backend-build        发布用构建（-trimpath -ldflags=\"$(LDFLAGS_REL)\"）"
	@echo "  backend-build-debug  含调试符号，便于 delve/栈追踪"
	@echo "  backend-test         go test ./..."
	@echo "  backend-tidy         go mod tidy"
	@echo "  backend-run          go run ./cmd/server"
	@echo ""
	@echo "前端:"
	@echo "  frontend-install     npm install"
	@echo "  frontend-build       npm run build"
	@echo "  frontend-test        npm run test"
	@echo ""
	@echo "其它:"
	@echo "  test                 后端 + 前端测试"
	@echo "  clean                删除后端生成的二进制"
	@echo "  docker-build         docker build（上下文 $(BACKEND_DIR)）"

# ---------- 后端 ----------

backend-build:
	cd $(BACKEND_DIR) && go build -trimpath -ldflags="$(LDFLAGS_REL)" -o $(BINARY) ./cmd/server
	@ls -lh $(BACKEND_DIR)/$(BINARY)

backend-build-debug:
	cd $(BACKEND_DIR) && go build -trimpath -o $(BINARY) ./cmd/server
	@ls -lh $(BACKEND_DIR)/$(BINARY)

backend-test:
	cd $(BACKEND_DIR) && go test ./... -count=1

backend-tidy:
	cd $(BACKEND_DIR) && go mod tidy

backend-run:
	cd $(BACKEND_DIR) && go run ./cmd/server

# ---------- 前端 ----------

frontend-install:
	cd $(FRONTEND_DIR) && npm install

frontend-build:
	cd $(FRONTEND_DIR) && npm run build

frontend-test:
	cd $(FRONTEND_DIR) && npm run test

# ---------- 汇总 ----------

test: backend-test frontend-test

clean:
	rm -f $(BACKEND_DIR)/$(BINARY)

docker-build:
	docker build -t clash-config-store:latest $(BACKEND_DIR)
