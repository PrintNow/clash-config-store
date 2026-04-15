# Stage 1: Build frontend
FROM --platform=$BUILDPLATFORM node:20-alpine AS frontend-builder

WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# Stage 2: Build backend
FROM golang:1.25-alpine AS backend-builder

ARG TARGETOS
ARG TARGETARCH

RUN apk --no-cache add build-base

WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download
COPY . ./

RUN CGO_ENABLED=1 GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -trimpath -ldflags="-s -w" -o clash-config-store ./cmd/server

# Stage 3: Final image
FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

COPY --from=backend-builder /build/clash-config-store ./app/
COPY --from=frontend-builder /app/dist ./frontend/dist

EXPOSE 8080

CMD ["sh", "-c", "mkdir -p dist && cp -r ./frontend/dist/* ./dist/ && ./app/clash-config-store"]
