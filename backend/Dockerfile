FROM golang:1.25-alpine AS builder

# 安装 CGO 依赖（SQLite 需要 gcc）
RUN apk --no-cache add build-base

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=1 GOOS=linux go build -o clash-config-store ./cmd/server

# ---- 运行阶段 ----
FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata sqlite

WORKDIR /app

COPY --from=builder /app/clash-config-store .

EXPOSE 8080

CMD ["./clash-config-store"]
