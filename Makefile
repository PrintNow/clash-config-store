# Clash Config Store

FRONTEND_DIR := frontend
BINARY       := bin/clash-config-store
# 前端生产构建版本展示；可被覆盖。Docker 构建请用 --build-arg VITE_BUILD_LABEL=...
VITE_BUILD_LABEL ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "v0.0.0-local")
LDFLAGS      := -s -w
GEOIP_DIR    := .docker/geoip
GEOIP_FILE   := $(GEOIP_DIR)/GeoLite2-City.mmdb
GEOIP_URL    ?= https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-City.mmdb

.PHONY: help build test clean run geoip docker-build

help:
	@echo "  build   生产构建: 前端打包 -> zip -> 后端二进制"
	@echo "  geoip   下载 GeoLite2-City.mmdb 到 .docker/geoip/"
	@echo "  docker-build  下载 GeoIP 并构建 Docker 镜像"
	@echo "  run     开发运行: 编译并运行（使用前端 dist 目录）"
	@echo "  test    Run backend tests"
	@echo "  clean   Remove build artifacts"

build:
	@mkdir -p bin
	@cd $(FRONTEND_DIR) && VITE_BUILD_LABEL="$(VITE_BUILD_LABEL)" npm run build
	@cd $(FRONTEND_DIR) && zip -r - dist > ../static/assets.zip
	@go build -trimpath -ldflags="$(LDFLAGS)" -o $(BINARY) ./cmd/server
	@ls -lh $(BINARY)

run:
	@go build -trimpath -ldflags="$(LDFLAGS)" -tags dev -o $(BINARY) ./cmd/server
	@./$(BINARY)

geoip:
	@mkdir -p $(GEOIP_DIR)
	@echo "Downloading GeoIP database from $(GEOIP_URL)"
	@curl -fL "$(GEOIP_URL)" -o "$(GEOIP_FILE)"
	@ls -lh "$(GEOIP_FILE)"

docker-build: geoip
	@docker build --build-arg GEOIP_MMDB_URL="$(GEOIP_URL)" --build-arg VITE_BUILD_LABEL="$(VITE_BUILD_LABEL)" -t clash-config-store:latest .

test:
	go test ./...

clean:
	rm -rf bin/
	rm -f ./static/assets.zip
