# Clash Config Store

一个 Mihomo/Clash 配置订阅管理平台，支持多上游订阅源聚合、自定义规则注入、访问安全限制，输出完整 mihomo YAML 配置文件。

## 功能特性

- **多订阅源管理**：添加多个上游代理订阅 URL，支持自定义 User-Agent
- **自定义规则集**：自定义 proxies、proxy-groups、rules，灵活注入到最终配置
- **订阅链接生成**：生成带随机 Token 的订阅 URL，输出完整 mihomo YAML
- **访问安全限制**：基于 IP、CIDR、国家/城市的白名单/黑名单控制
- **访问日志**：记录每次订阅访问的 IP 和地理信息
- **混合缓存**：上游订阅内容自动缓存，过期后后台异步刷新
- **响应式 UI**：PC 优先，支持深色/浅色主题，中英文切换

## 技术栈

| 层次 | 技术 |
|------|------|
| 后端 | Go 1.22+, Gin, GORM, golang-jwt |
| 数据库 | SQLite（默认）或 MySQL |
| 前端 | React 18, TypeScript, Vite, ShadcnUI, Tailwind |
| 状态管理 | Zustand + TanStack Query |
| 国际化 | i18next（中/英） |

## 快速启动

### 方式一：Docker Compose（推荐）

**SQLite 版本（零配置）：**
```bash
# 克隆项目
git clone <repo-url>
cd clash-config-store

# 启动
JWT_SECRET=your-random-secret docker compose up -d

# 访问
# 前端：http://localhost:80
# 后端 API：http://localhost:8080
```

**MySQL 版本：**
```bash
JWT_SECRET=your-random-secret \
MYSQL_PASSWORD=your-db-password \
BASE_URL=http://your-domain:8080 \
docker compose -f docker-compose.mysql.yml up -d
```

### 方式二：本地开发

**后端：**
```bash
cd backend

# 复制环境变量配置
cp .env.example .env
# 编辑 .env，至少修改 JWT_SECRET

# 安装依赖
go mod tidy

# 启动（SQLite 会自动创建）
go run ./cmd/server
```

**前端：**
```bash
cd frontend
npm install
npm run dev
# 访问 http://localhost:5173
```

## GeoIP 配置（可选，用于 IP 地理限制）

1. 注册 MaxMind 免费账号：https://www.maxmind.com/en/geolite2/signup
2. 下载 `GeoLite2-City.mmdb`
3. 将文件放到指定路径，在 `.env` 中配置 `GEOIP_PATH`

Docker 部署时，将 `.mmdb` 文件挂载到容器的 `/data/GeoLite2-City.mmdb`（已在 docker-compose.yml 中配置好挂载点，只需将文件放入 Docker volume）。

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `8080` | 后端监听端口 |
| `DB_TYPE` | `sqlite` | 数据库类型：`sqlite` 或 `mysql` |
| `DB_DSN` | `clash-config-store.db` | SQLite 文件路径或 MySQL DSN |
| `JWT_SECRET` | *(需修改)* | JWT 签名密钥，请使用随机字符串 |
| `JWT_EXPIRY_HOURS` | `24` | JWT 有效期（小时） |
| `GEOIP_PATH` | *(空)* | MaxMind GeoLite2 `.mmdb` 文件路径 |
| `BASE_URL` | `http://localhost:8080` | 服务对外访问 URL，用于生成订阅链接 |

## 使用指南

### 1. 注册账号

访问前端，注册一个账号（邮箱 + 用户名 + 密码）。

### 2. 添加订阅源

进入「订阅源」页面，添加上游代理订阅 URL。

- 可以先在「UA 库」中添加自定义 User-Agent，供应商 UA 校验时使用
- 默认 UA 为 `mihomo/1.18.0`

### 3. 创建规则集（可选）

进入「规则集」页面，创建自定义规则集：
- `proxies`：YAML 格式的代理节点列表
- `proxy-groups`：YAML 格式的代理组，可引用上游节点（节点名带前缀如 `[Provider名] 节点名`）
- `rules`：Mihomo 路由规则列表

### 4. 创建订阅

进入「订阅管理」→「创建订阅」，然后进入详情页配置：
- **代理源 Tab**：勾选启用的订阅源，开启节点前缀
- **规则集 Tab**：选择规则集，设置插入位置（前置/后置/替换）
- **基础配置 Tab**：填写 JSON 格式的 mihomo 基础配置（端口、DNS 等）
- **访问限制 Tab**：配置 IP/国家白名单或黑名单

### 5. 使用订阅链接

将生成的订阅链接填入 Mihomo/Clash 客户端即可。

订阅链接格式：`http://<BASE_URL>/sub/<token>`

## 订阅输出格式

生成的 YAML 为完整的 Mihomo 配置文件：

```yaml
mixed-port: 7890
allow-lan: false
mode: rule
log-level: info

proxies:
  - name: "[Provider1] 香港01"
    type: vmess
    ...
  - name: "my-custom-proxy"
    ...

proxy-groups:
  - name: "Proxy"
    type: select
    proxies: ["[Provider1] 香港01", "DIRECT"]

rules:
  - DOMAIN,example.com,Proxy
  - MATCH,DIRECT
```

## 开发

```bash
# 后端代码检查
cd backend && go vet ./...

# 前端类型检查
cd frontend && npm run build
```
