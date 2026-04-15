# Clash Config Store

FRONTEND_DIR := frontend
BINARY       := bin/clash-config-store
LDFLAGS      := -s -w

.PHONY: help build test clean run

help:
	@echo "  build   生产构建: 前端打包 -> zip -> 后端二进制"
	@echo "  run     开发运行: 编译并运行（使用前端 dist 目录）"
	@echo "  test    Run backend tests"
	@echo "  clean   Remove build artifacts"

build:
	@mkdir -p bin
	@cd $(FRONTEND_DIR) && npm run build
	@cd $(FRONTEND_DIR) && zip -r - dist > ../static/assets.zip
	@go build -trimpath -ldflags="$(LDFLAGS)" -o $(BINARY) ./cmd/server
	@ls -lh $(BINARY)

run:
	@go build -trimpath -ldflags="$(LDFLAGS)" -tags dev -o $(BINARY) ./cmd/server
	@./$(BINARY)

test:
	go test ./...

clean:
	rm -rf bin/
	rm -f ./static/assets.zip
