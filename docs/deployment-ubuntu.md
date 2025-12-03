# AI 语音面试系统 - Ubuntu 服务器部署指南

## 目录

1. [系统要求](#系统要求)
2. [环境准备](#环境准备)
3. [部署步骤](#部署步骤)
4. [配置说明](#配置说明)
5. [SSL 证书配置](#ssl-证书配置)
6. [启动服务](#启动服务)
7. [数据初始化](#数据初始化)
8. [维护命令](#维护命令)
9. [常见问题](#常见问题)

---

## 系统要求

### 硬件要求

| 配置项 | 最低要求 | 推荐配置 |
|--------|----------|----------|
| CPU | 2 核 | 4 核+ |
| 内存 | 4 GB | 8 GB+ |
| 硬盘 | 40 GB | 100 GB+ SSD |
| 带宽 | 5 Mbps | 10 Mbps+ |

### 软件要求

- Ubuntu 20.04 LTS / 22.04 LTS
- Docker 24.0+
- Docker Compose 2.0+

---

## 环境准备

### 1. 更新系统

```bash
sudo apt update && sudo apt upgrade -y
```

### 2. 安装 Docker

```bash
# 安装依赖
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# 添加 Docker GPG 密钥
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# 添加 Docker 仓库
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 安装 Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 启动 Docker 并设置开机自启
sudo systemctl start docker
sudo systemctl enable docker

# 将当前用户添加到 docker 组（免 sudo）
sudo usermod -aG docker $USER
newgrp docker
```

### 3. 验证安装

```bash
docker --version
docker compose version
```

---

## 部署步骤

### 1. 上传项目文件

将 `ai-voice-interview.zip` 上传到服务器并解压：

```bash
# 创建项目目录
mkdir -p /opt/ai-interview
cd /opt/ai-interview

# 解压项目文件（假设已上传到 /tmp）
unzip /tmp/ai-voice-interview.zip -d .

# 或使用 scp 从本地上传
# scp ai-voice-interview.zip user@server:/tmp/
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑环境变量
nano .env
```

**必须修改的配置项：**

```bash
# ============================================
# Anthropic Claude API 配置（LLM）
# ============================================
ANTHROPIC_API_KEY="your-anthropic-api-key"

# ============================================
# OpenAI API 配置（ASR + TTS）
# ============================================
OPENAI_API_KEY="your-openai-api-key"

# ============================================
# NextAuth 认证配置
# ============================================
NEXTAUTH_SECRET="your-random-secret-key-at-least-32-chars"
NEXTAUTH_URL="https://your-domain.com"

# ============================================
# 应用配置
# ============================================
NEXT_PUBLIC_APP_URL="https://your-domain.com"
```

**生成随机密钥：**

```bash
openssl rand -base64 32
```

### 3. 配置 SSL 证书

#### 方式一：使用 Let's Encrypt（推荐）

```bash
# 安装 certbot
sudo apt install -y certbot

# 获取证书（需要先停止 nginx 或使用 DNS 验证）
sudo certbot certonly --standalone -d your-domain.com

# 复制证书到项目目录
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem docker/nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem docker/nginx/ssl/key.pem
sudo chmod 644 docker/nginx/ssl/*.pem
```

#### 方式二：使用自签名证书（测试环境）

```bash
mkdir -p docker/nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout docker/nginx/ssl/key.pem \
  -out docker/nginx/ssl/cert.pem \
  -subj "/CN=your-domain.com"
```

### 4. 修改 Nginx 配置

编辑 `docker/nginx/nginx.conf`，将 `localhost` 替换为你的域名：

```bash
nano docker/nginx/nginx.conf
```

---

## 启动服务

### 1. 构建并启动所有服务

```bash
cd /opt/ai-interview
docker compose up -d --build
```

### 2. 查看服务状态

```bash
docker compose ps
```

预期输出：

```
NAME                    STATUS              PORTS
ai-interview-app-1      Up                  3000/tcp
ai-interview-nginx-1    Up                  0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
ai-interview-postgres-1 Up (healthy)        0.0.0.0:5432->5432/tcp
ai-interview-redis-1    Up                  0.0.0.0:6379->6379/tcp
ai-interview-minio-1    Up                  0.0.0.0:9000->9000/tcp, 0.0.0.0:9001->9001/tcp
```

### 3. 查看日志

```bash
# 查看所有服务日志
docker compose logs -f

# 查看特定服务日志
docker compose logs -f app
```

---

## 数据初始化

### 1. 执行数据库迁移

```bash
docker compose exec app npx prisma migrate deploy
```

### 2. 初始化种子数据

```bash
docker compose exec app npx prisma db seed
```

### 3. 默认管理员账号

- 邮箱：`admin@example.com`
- 密码：`admin123`

**重要：首次登录后请立即修改密码！**

---

## 维护命令

### 服务管理

```bash
# 启动服务
docker compose up -d

# 停止服务
docker compose down

# 重启服务
docker compose restart

# 重启单个服务
docker compose restart app
```

### 更新部署

```bash
# 拉取最新代码后
docker compose down
docker compose up -d --build
docker compose exec app npx prisma migrate deploy
```

### 数据备份

```bash
# 备份数据库
docker compose exec postgres pg_dump -U postgres interview > backup_$(date +%Y%m%d).sql

# 恢复数据库
docker compose exec -T postgres psql -U postgres interview < backup_20241201.sql
```

### 查看资源使用

```bash
docker stats
```

---

## 配置说明

### 环境变量详解

| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql://postgres:postgres@postgres:5432/interview` |
| `REDIS_URL` | Redis 连接字符串 | `redis://redis:6379` |
| `ANTHROPIC_API_KEY` | Claude API 密钥 | `sk-ant-xxx` |
| `OPENAI_API_KEY` | OpenAI API 密钥 | `sk-xxx` |
| `NEXTAUTH_SECRET` | NextAuth 加密密钥 | 随机 32 位字符串 |
| `NEXTAUTH_URL` | 应用访问地址 | `https://your-domain.com` |
| `MINIO_ACCESS_KEY` | MinIO 访问密钥 | `minioadmin` |
| `MINIO_SECRET_KEY` | MinIO 密钥 | `minioadmin123` |

### API Key 获取方式

1. **Anthropic Claude API**
   - 访问 https://console.anthropic.com/
   - 注册账号并创建 API Key

2. **OpenAI API**
   - 访问 https://platform.openai.com/
   - 注册账号并创建 API Key

---

## 常见问题

### 1. 容器启动失败

```bash
# 查看详细日志
docker compose logs app

# 常见原因：
# - 环境变量未配置
# - 端口被占用
# - 内存不足
```

### 2. 数据库连接失败

```bash
# 检查 PostgreSQL 状态
docker compose ps postgres

# 手动连接测试
docker compose exec postgres psql -U postgres -d interview
```

### 3. SSL 证书问题

```bash
# 检查证书文件
ls -la docker/nginx/ssl/

# 验证证书
openssl x509 -in docker/nginx/ssl/cert.pem -text -noout
```

### 4. 端口被占用

```bash
# 查看端口占用
sudo lsof -i :80
sudo lsof -i :443

# 停止占用进程
sudo kill -9 <PID>
```

### 5. 磁盘空间不足

```bash
# 清理 Docker 缓存
docker system prune -a

# 查看磁盘使用
df -h
```

---

## 防火墙配置

```bash
# 开放必要端口
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 性能优化建议

1. **启用 Swap**（内存不足时）
   ```bash
   sudo fallocate -l 4G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```

2. **配置日志轮转**
   ```bash
   # 编辑 /etc/docker/daemon.json
   {
     "log-driver": "json-file",
     "log-opts": {
       "max-size": "10m",
       "max-file": "3"
     }
   }
   ```

3. **定期备份**
   - 建议每日备份数据库
   - 使用 cron 定时任务自动化

---

## 技术支持

如遇到问题，请检查：
1. 服务日志：`docker compose logs -f`
2. 系统资源：`htop` 或 `docker stats`
3. 网络连接：`curl -v https://your-domain.com`

---

*文档版本：v1.0*
*最后更新：2024-12*
