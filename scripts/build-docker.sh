#!/bin/bash
set -e

cd "$(dirname "$0")/.."

IMAGE_REPO="${IMAGE_REPO:-}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

if [[ -z "${IMAGE_REPO}" ]]; then
  echo "ERROR: IMAGE_REPO is required, e.g. IMAGE_REPO=registry.example.com/clash-config-store"
  exit 1
fi

IMAGE_REF="${IMAGE_REPO}:${IMAGE_TAG}"

echo "Building multi-arch image (amd64, arm64)..."
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --output type=image,push=true \
  -t "${IMAGE_REF}" \
  .
