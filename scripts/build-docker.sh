#!/bin/bash
set -e

cd "$(dirname "$0")/.."

IMAGE_REPO="${IMAGE_REPO:-shine09/clash-config-store}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

if [[ -z "${IMAGE_REPO}" ]]; then
  echo "ERROR: IMAGE_REPO is required, e.g. IMAGE_REPO=registry.example.com/clash-config-store"
  exit 1
fi

IMAGE_REF="${IMAGE_REPO}:${IMAGE_TAG}"

# 与 Makefile 一致：优先用已导出的 VITE_BUILD_LABEL（CI 可设），否则用 git describe
if [[ -z "${VITE_BUILD_LABEL:-}" ]]; then
  VITE_BUILD_LABEL="$(git describe --tags --always --dirty 2>/dev/null || echo "v0.0.0-local")"
fi

echo "VITE_BUILD_LABEL=${VITE_BUILD_LABEL}"
echo "Building multi-arch image (amd64, arm64)..."
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --output type=image,push=true \
  --build-arg "VITE_BUILD_LABEL=${VITE_BUILD_LABEL}" \
  -t "${IMAGE_REF}" \
  .
