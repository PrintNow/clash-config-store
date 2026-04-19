# Stage 1: Build frontend
FROM --platform=$BUILDPLATFORM node:25-alpine AS frontend-builder

WORKDIR /app
RUN apk --no-cache add zip
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./

ARG VITE_BUILD_LABEL=v0.0.0-docker
ENV VITE_BUILD_LABEL=$VITE_BUILD_LABEL

RUN npm run build && zip -r - dist > /tmp/assets.zip

# Stage 2: Build backend
FROM --platform=$BUILDPLATFORM golang:1.25-alpine AS backend-builder

ARG TARGETOS
ARG TARGETARCH

WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download
COPY . ./

RUN CGO_ENABLED=0 GOOS=${TARGETOS} GOARCH=${TARGETARCH} go build -trimpath -ldflags="-s -w" -o clash-config-store ./cmd/server

# Stage 3: Download GeoIP database
FROM alpine:latest AS geoip-downloader

ARG GEOIP_MMDB_URL=https://github.com/P3TERX/GeoLite.mmdb/releases/latest/download/GeoLite2-City.mmdb

ADD $GEOIP_MMDB_URL /geoip/GeoLite2-City.mmdb

# Stage 4: Final image
FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata \
 && mkdir -p /data/geoip

WORKDIR /app

COPY --from=backend-builder /build/clash-config-store ./clash-config-store
COPY --from=frontend-builder /tmp/assets.zip ./static/assets.zip
COPY --from=geoip-downloader /geoip/GeoLite2-City.mmdb /data/geoip/GeoLite2-City.mmdb

EXPOSE 26406

CMD ["./clash-config-store"]
