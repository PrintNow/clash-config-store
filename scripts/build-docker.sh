#!/bin/bash
set -e

cd "$(dirname "$0")/.."

echo "Building multi-arch image (amd64, arm64)..."
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --output type=image,push=true \
  -t docker.registry.nowtool.cn/clash-config-store:latest \
  .
