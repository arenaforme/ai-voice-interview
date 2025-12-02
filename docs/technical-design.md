# AI 语音面试系统 - 技术设计方案 v1.0

## 1. 系统架构

### 1.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Docker Host                               │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    docker-compose                            ││
│  │                                                              ││
│  │  ┌──────────┐    ┌──────────────┐    ┌──────────────────┐  ││
│  │  │  Nginx   │    │   Next.js    │    │    PostgreSQL    │  ││
│  │  │  :80/443 │───▶│   App :3000  │───▶│      :5432       │  ││
│  │  └──────────┘    └──────────────┘    └──────────────────┘  ││
│  │                         │                                    ││
│  │                         ▼                                    ││
│  │                  ┌──────────────┐    ┌──────────────────┐  ││
│  │                  │    Redis     │    │      MinIO       │  ││
│  │                  │    :6379     │    │   :9000/:9001    │  ││
│  │                  └──────────────┘    └──────────────────┘  ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (HTTPS)
                    ┌──────────────────┐
                    │   OpenAI API     │
                    │  - Whisper (ASR) │
                    │  - GPT-4 (LLM)   │
                    │  - TTS           │
                    └──────────────────┘
```

### 1.2 服务组件说明

| 服务 | 镜像 | 端口 | 用途 |
|------|------|------|------|
| nginx | nginx:alpine | 80, 443 | 反向代理、SSL 终止、静态资源缓存 |
| app | node:20-alpine | 3000 | Next.js 应用（前端 + API） |
| postgres | postgres:16-alpine | 5432 | 主数据库 |
| redis | redis:7-alpine | 6379 | 会话存储、任务队列、缓存 |
| minio | minio/minio | 9000, 9001 | 对象存储（录音文件） |

---

## 2. 技术栈明细

### 2.1 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 14.x | React 全栈框架 |
| TypeScript | 5.x | 类型安全 |
| Tailwind CSS | 3.x | 样式框架 |
| shadcn/ui | latest | UI 组件库 |
| React Query | 5.x | 服务端状态管理 |
| Zustand | 4.x | 客户端状态管理 |

### 2.2 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js API Routes | 14.x | API 层 |
| Prisma | 5.x | ORM |
| NextAuth.js | 4.x | 认证 |
| BullMQ | 5.x | 任务队列（AI 处理） |
| Zod | 3.x | 数据校验 |

### 2.3 AI 服务

| 服务 | 提供商 | 用途 |
|------|--------|------|
| ASR | OpenAI Whisper API | 语音转文字 |
| LLM | **Anthropic Claude API** | 面试评估、生成问题 |
| TTS | OpenAI TTS API | 文字转语音 |

> **说明**：Claude API 仅提供 LLM 能力，ASR 和 TTS 仍使用 OpenAI API（Whisper 和 TTS 质量优秀）。

### 2.4 基础设施

| 组件 | 技术 | 用途 |
|------|------|------|
| 数据库 | PostgreSQL 16 | 结构化数据存储 |
| 缓存 | Redis 7 | 会话、队列、缓存 |
| 对象存储 | MinIO | 录音文件存储 |
| 反向代理 | Nginx | 负载均衡、SSL |
| 容器编排 | Docker Compose | 本地部署 |

---

## 3. 数据库设计

### 3.1 ER 图

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
│    User      │     │   Position   │     │ InterviewTemplate│
├──────────────┤     ├──────────────┤     ├──────────────────┤
│ id           │     │ id           │     │ id               │
│ email        │     │ name         │◀────│ position_id      │
│ password     │     │ code         │     │ name             │
│ name         │     │ description  │     │ questions (JSON) │
│ role         │     │ status       │     │ dimensions (JSON)│
│ created_at   │     │ created_at   │     │ settings (JSON)  │
└──────────────┘     └──────────────┘     └──────────────────┘
        │                   │
        │                   │
        ▼                   ▼
┌──────────────────────────────────────┐
│             Interview                 │
├──────────────────────────────────────┤
│ id                                   │
│ candidate_name                       │
│ candidate_email                      │
│ candidate_phone                      │
│ position_id ─────────────────────────┼──▶ Position
│ template_id ─────────────────────────┼──▶ InterviewTemplate
│ token (unique)                       │
│ status (pending/in_progress/done)    │
│ started_at                           │
│ completed_at                         │
│ created_by ──────────────────────────┼──▶ User
│ created_at                           │
└──────────────────────────────────────┘
        │
        │ 1:N
        ▼
┌──────────────────────────────────────┐
│           InterviewRound             │
├──────────────────────────────────────┤
│ id                                   │
│ interview_id ────────────────────────┼──▶ Interview
│ round_number                         │
│ question_text                        │
│ question_audio_url                   │
│ answer_text (ASR 转写)               │
│ answer_audio_url                     │
│ dimension                            │
│ score (0-5)                          │
│ evaluation                           │
│ duration_seconds                     │
│ created_at                           │
└──────────────────────────────────────┘
        │
        │ N:1
        ▼
┌──────────────────────────────────────┐
│          InterviewReport             │
├──────────────────────────────────────┤
│ id                                   │
│ interview_id (unique) ───────────────┼──▶ Interview
│ dimension_scores (JSON)              │
│ strengths (JSON)                     │
│ risks (JSON)                         │
│ recommendation (推荐/谨慎/不推荐)     │
│ summary                              │
│ hr_decision (通过/不通过/待定)        │
│ hr_notes                             │
│ created_at                           │
│ updated_at                           │
└──────────────────────────────────────┘
```

### 3.2 核心表结构

详见附录 A：Prisma Schema

---

## 4. API 接口设计

### 4.1 认证相关

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/auth/login` | HR 登录 |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/auth/me` | 获取当前用户 |

### 4.2 岗位管理 (HR)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/positions` | 获取岗位列表 |
| GET | `/api/positions/:id` | 获取岗位详情 |
| POST | `/api/positions` | 创建岗位 |
| PUT | `/api/positions/:id` | 更新岗位 |
| PATCH | `/api/positions/:id/status` | 启用/停用岗位 |

### 4.3 面试管理 (HR)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/interviews` | 面试列表（支持筛选分页） |
| POST | `/api/interviews` | 创建面试（生成链接） |
| GET | `/api/interviews/:id` | 面试详情 |
| GET | `/api/interviews/:id/report` | 获取面试报告 |
| PATCH | `/api/interviews/:id/decision` | HR 标记决策 |

### 4.4 候选人面试 (Public)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/candidate/interview/:token` | 获取面试信息 |
| POST | `/api/candidate/interview/:token/start` | 开始面试 |
| POST | `/api/candidate/interview/:token/answer` | 提交回答（上传录音） |
| GET | `/api/candidate/interview/:token/status` | 获取当前状态 |

### 4.5 核心接口详细设计

#### 4.5.1 提交回答接口

```typescript
// POST /api/candidate/interview/:token/answer
// Content-Type: multipart/form-data

// Request
{
  audio: File,           // 录音文件 (webm/wav)
  roundNumber: number    // 当前题号
}

// Response
{
  success: boolean,
  data: {
    isComplete: boolean,           // 面试是否结束
    nextQuestion?: {
      roundNumber: number,
      questionText: string,
      questionAudioUrl: string,    // TTS 生成的音频
      dimension: string            // 考察维度
    },
    report?: InterviewReport       // 如果结束，返回报告
  }
}
```

---

## 5. 核心流程设计

### 5.1 面试流程时序图

```
候选人          前端           后端API          AI服务          存储
  │              │               │               │              │
  │──打开链接───▶│               │               │              │
  │              │──GET /interview/:token──────▶│              │
  │              │◀─────────面试信息─────────────│              │
  │              │               │               │              │
  │──授权麦克风──│               │               │              │
  │──点击开始───▶│               │               │              │
  │              │──POST /start─▶│               │              │
  │              │◀──第1题(文本+音频URL)─────────│              │
  │              │               │               │              │
  │◀─播放问题────│               │               │              │
  │              │               │               │              │
  │──语音回答───▶│               │               │              │
  │──点击结束───▶│               │               │              │
  │              │──POST /answer (audio)────────▶│              │
  │              │               │──上传录音────▶│              │──▶MinIO
  │              │               │──ASR─────────▶│ Whisper      │
  │              │               │◀─────转写文本─│              │
  │              │               │──LLM评分─────▶│ GPT-4        │
  │              │               │◀──评分+下一题─│              │
  │              │               │──TTS─────────▶│ TTS API      │
  │              │               │◀─────音频URL──│              │──▶MinIO
  │              │◀──下一题(文本+音频URL)────────│              │
  │              │               │               │              │
  │    ... 重复 N 轮 ...         │               │              │
  │              │               │               │              │
  │              │◀──面试结束+报告───────────────│              │
  │◀─显示结束页──│               │               │              │
```

### 5.2 AI 处理流水线

```
┌─────────────────────────────────────────────────────────────┐
│                    Answer Processing Pipeline                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐ │
│  │ Upload  │───▶│   ASR   │───▶│   LLM   │───▶│   TTS   │ │
│  │ Audio   │    │ Whisper │    │ Claude  │    │ OpenAI  │ │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘ │
│       │              │              │              │        │
│       ▼              ▼              ▼              ▼        │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐ │
│  │  MinIO  │    │ 转写文本 │    │ 评分    │    │ 音频URL │ │
│  │  存储   │    │  存储   │    │ 下一题  │    │  存储   │ │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘ │
│                                                             │
│  预计耗时: 0.5s + 2-3s (Whisper) + 2-3s (Claude) + 1-2s (TTS) = 5-8s │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. 项目目录结构

```
ai-voice-interview/
├── docker/
│   ├── nginx/
│   │   ├── nginx.conf
│   │   └── ssl/                    # SSL 证书（可选）
│   └── postgres/
│       └── init.sql                # 数据库初始化脚本
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── (auth)/                 # 认证相关页面
│   │   │   ├── login/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (hr)/                   # HR 后台页面
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── positions/page.tsx
│   │   │   ├── interviews/
│   │   │   │   ├── page.tsx        # 面试列表
│   │   │   │   └── [id]/page.tsx   # 面试详情/报告
│   │   │   └── layout.tsx
│   │   ├── (candidate)/            # 候选人页面
│   │   │   └── interview/
│   │   │       └── [token]/page.tsx
│   │   ├── api/                    # API Routes
│   │   │   ├── auth/
│   │   │   │   └── [...nextauth]/route.ts
│   │   │   ├── positions/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/route.ts
│   │   │   ├── interviews/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/
│   │   │   │       ├── route.ts
│   │   │   │       └── report/route.ts
│   │   │   └── candidate/
│   │   │       └── interview/
│   │   │           └── [token]/
│   │   │               ├── route.ts
│   │   │               ├── start/route.ts
│   │   │               └── answer/route.ts
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                     # shadcn/ui 组件
│   │   ├── interview/              # 面试相关组件
│   │   │   ├── AudioRecorder.tsx
│   │   │   ├── AudioPlayer.tsx
│   │   │   ├── QuestionDisplay.tsx
│   │   │   └── InterviewProgress.tsx
│   │   ├── hr/                     # HR 后台组件
│   │   │   ├── InterviewList.tsx
│   │   │   ├── ReportCard.tsx
│   │   │   └── DimensionChart.tsx
│   │   └── common/                 # 通用组件
│   ├── lib/
│   │   ├── ai/                     # AI 服务封装
│   │   │   ├── anthropic.ts        # Claude API 客户端
│   │   │   ├── openai.ts           # OpenAI 客户端（ASR/TTS）
│   │   │   ├── asr.ts              # 语音识别（Whisper）
│   │   │   ├── llm.ts              # LLM 调用（Claude）
│   │   │   ├── tts.ts              # 语音合成（OpenAI TTS）
│   │   │   └── prompts/            # Prompt 模板
│   │   │       ├── interviewer.ts
│   │   │       └── evaluator.ts
│   │   ├── db/
│   │   │   └── prisma.ts           # Prisma 客户端
│   │   ├── storage/
│   │   │   └── minio.ts            # MinIO 客户端
│   │   ├── auth/
│   │   │   └── options.ts          # NextAuth 配置
│   │   └── utils/
│   │       ├── token.ts            # Token 生成
│   │       └── validation.ts       # Zod schemas
│   ├── hooks/                      # React Hooks
│   │   ├── useAudioRecorder.ts
│   │   └── useInterview.ts
│   └── types/                      # TypeScript 类型
│       └── index.ts
├── prisma/
│   ├── schema.prisma               # 数据库模型
│   ├── migrations/                 # 迁移文件
│   └── seed.ts                     # 种子数据
├── public/
│   └── audio/                      # 静态音频资源
├── .env.example                    # 环境变量模板
├── .env.local                      # 本地环境变量
├── docker-compose.yml              # Docker 编排
├── Dockerfile                      # 应用镜像
├── package.json
├── tsconfig.json
└── tailwind.config.ts
```

---

## 7. Docker 部署配置

### 7.1 docker-compose.yml

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./docker/nginx/ssl:/etc/nginx/ssl:ro
    depends_on:
      - app
    restart: unless-stopped

  app:
    build:
      context: .
      dockerfile: Dockerfile
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/interview
      - REDIS_URL=redis://redis:6379
      - MINIO_ENDPOINT=minio
      - MINIO_PORT=9000
      - MINIO_ACCESS_KEY=${MINIO_ACCESS_KEY}
      - MINIO_SECRET_KEY=${MINIO_SECRET_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NEXTAUTH_URL=${NEXTAUTH_URL}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started
      minio:
        condition: service_started
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=interview
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    restart: unless-stopped

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      - MINIO_ROOT_USER=${MINIO_ACCESS_KEY}
      - MINIO_ROOT_PASSWORD=${MINIO_SECRET_KEY}
    volumes:
      - minio_data:/data
    ports:
      - "9001:9001"  # MinIO Console（仅开发环境）
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

### 7.2 Dockerfile

```dockerfile
FROM node:20-alpine AS base

# 安装依赖阶段
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# 构建阶段
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# 生产阶段
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
```

### 7.3 nginx.conf（HTTPS 配置）

```nginx
events {
    worker_connections 1024;
}

http {
    upstream app {
        server app:3000;
    }

    # HTTP 重定向到 HTTPS
    server {
        listen 80;
        server_name localhost;
        return 301 https://$server_name$request_uri;
    }

    # HTTPS 服务
    server {
        listen 443 ssl http2;
        server_name localhost;

        # SSL 证书配置
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        # SSL 安全配置
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 1d;

        client_max_body_size 100M;  # 支持大文件上传（录音）

        location / {
            proxy_pass http://app;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }

        # MinIO 代理（用于音频文件访问）
        location /storage/ {
            proxy_pass http://minio:9000/;
            proxy_set_header Host $host;
        }
    }
}
```

### 7.4 SSL 证书生成（开发环境自签名）

```bash
# 创建 SSL 证书目录
mkdir -p docker/nginx/ssl

# 生成自签名证书（开发环境使用）
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout docker/nginx/ssl/key.pem \
  -out docker/nginx/ssl/cert.pem \
  -subj "/C=CN/ST=Shanghai/L=Shanghai/O=Dev/CN=localhost"
```

> **生产环境**：建议使用 Let's Encrypt 免费证书或购买商业证书。

---

## 8. 环境变量配置

### 8.1 .env.example

```bash
# ============================================
# 数据库配置
# ============================================
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/interview"

# ============================================
# Redis 配置
# ============================================
REDIS_URL="redis://localhost:6379"

# ============================================
# MinIO 对象存储配置
# ============================================
MINIO_ENDPOINT="localhost"
MINIO_PORT="9000"
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin123"
MINIO_BUCKET="interview-audio"
MINIO_USE_SSL="false"

# ============================================
# Anthropic Claude API 配置（LLM）
# ============================================
ANTHROPIC_API_KEY="sk-ant-xxx"
ANTHROPIC_MODEL="claude-sonnet-4-20250514"

# ============================================
# OpenAI API 配置（ASR + TTS）
# ============================================
OPENAI_API_KEY="sk-xxx"
OPENAI_BASE_URL="https://api.openai.com/v1"  # 可配置代理
OPENAI_TTS_MODEL="tts-1"
OPENAI_TTS_VOICE="alloy"

# ============================================
# NextAuth 认证配置
# ============================================
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# ============================================
# 应用配置
# ============================================
NEXT_PUBLIC_APP_URL="http://localhost:3000"
INTERVIEW_MAX_ROUNDS="7"
INTERVIEW_ANSWER_TIMEOUT="90"
```

---

## 9. 开发与部署命令

### 9.1 本地开发

```bash
# 启动基础设施（数据库、Redis、MinIO）
docker-compose up -d postgres redis minio

# 安装依赖
npm install

# 数据库迁移
npx prisma migrate dev

# 初始化种子数据
npx prisma db seed

# 启动开发服务器
npm run dev
```

### 9.2 Docker 部署

```bash
# 构建并启动所有服务
docker-compose up -d --build

# 查看日志
docker-compose logs -f app

# 执行数据库迁移
docker-compose exec app npx prisma migrate deploy

# 停止服务
docker-compose down

# 清理数据卷（谨慎！）
docker-compose down -v
```

### 9.3 常用命令

```bash
# 生成 Prisma 客户端
npx prisma generate

# 打开 Prisma Studio（数据库管理）
npx prisma studio

# 类型检查
npm run type-check

# 代码格式化
npm run format

# 构建生产版本
npm run build
```

---

## 10. 已确认决策

### 10.1 AI 服务选型 ✅

| 决策项 | 确认方案 | 说明 |
|--------|----------|------|
| ASR | OpenAI Whisper API | 语音转文字，质量优秀 |
| LLM | **Anthropic Claude API** | 面试评估、问题生成 |
| TTS | OpenAI TTS API | 文字转语音 |

### 10.2 认证方案 ✅

| 决策项 | 确认方案 |
|--------|----------|
| HR 认证 | NextAuth.js (Credentials) |
| 候选人认证 | Token URL（无需登录） |

### 10.3 存储方案 ✅

| 决策项 | 确认方案 |
|--------|----------|
| 录音存储 | MinIO |
| 数据库 | PostgreSQL |

### 10.4 功能范围 ✅

| 功能项 | 状态 |
|--------|------|
| HTTPS | ✅ 需要（已配置自签名证书方案） |
| 国际化 | ❌ 不需要 |
| PDF 导出 | ❌ 不需要 |
| 邮件通知 | ❌ 不需要 |

---

## 附录 A：Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  ADMIN
  HR
}

enum PositionStatus {
  ACTIVE
  INACTIVE
}

enum InterviewStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  EXPIRED
}

enum HRDecision {
  PENDING
  PASSED
  REJECTED
  HOLD
}

enum Recommendation {
  RECOMMENDED
  CAUTIOUS
  NOT_RECOMMENDED
}

model User {
  id         String      @id @default(cuid())
  email      String      @unique
  password   String
  name       String
  role       UserRole    @default(HR)
  createdAt  DateTime    @default(now())
  updatedAt  DateTime    @updatedAt
  interviews Interview[]
}

model Position {
  id          String             @id @default(cuid())
  name        String
  code        String             @unique
  description String?
  status      PositionStatus     @default(ACTIVE)
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt
  templates   InterviewTemplate[]
  interviews  Interview[]
}

model InterviewTemplate {
  id         String     @id @default(cuid())
  positionId String
  position   Position   @relation(fields: [positionId], references: [id])
  name       String
  questions  Json       // 预设问题列表
  dimensions Json       // 评估维度配置
  settings   Json       // 其他设置（轮数、超时等）
  isDefault  Boolean    @default(false)
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
  interviews Interview[]
}

model Interview {
  id             String           @id @default(cuid())
  candidateName  String
  candidateEmail String?
  candidatePhone String?
  positionId     String
  position       Position         @relation(fields: [positionId], references: [id])
  templateId     String
  template       InterviewTemplate @relation(fields: [templateId], references: [id])
  token          String           @unique
  status         InterviewStatus  @default(PENDING)
  startedAt      DateTime?
  completedAt    DateTime?
  createdById    String
  createdBy      User             @relation(fields: [createdById], references: [id])
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt
  rounds         InterviewRound[]
  report         InterviewReport?
}

model InterviewRound {
  id               String    @id @default(cuid())
  interviewId      String
  interview        Interview @relation(fields: [interviewId], references: [id])
  roundNumber      Int
  questionText     String
  questionAudioUrl String?
  answerText       String?
  answerAudioUrl   String?
  dimension        String
  score            Float?
  evaluation       String?
  durationSeconds  Int?
  createdAt        DateTime  @default(now())

  @@unique([interviewId, roundNumber])
}

model InterviewReport {
  id              String         @id @default(cuid())
  interviewId     String         @unique
  interview       Interview      @relation(fields: [interviewId], references: [id])
  dimensionScores Json           // { "专业能力": 4.2, "沟通表达": 3.8, ... }
  strengths       Json           // ["优势1", "优势2"]
  risks           Json           // ["风险1", "风险2"]
  recommendation  Recommendation
  summary         String
  hrDecision      HRDecision     @default(PENDING)
  hrNotes         String?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
}
```

---

## 附录 B：预估开发周期

| 阶段 | 任务 | 预估时间 |
|------|------|----------|
| **第 1 周** | 项目初始化、Docker 环境、数据库设计 | 2-3 天 |
| | HR 认证、基础 CRUD API | 2-3 天 |
| **第 2 周** | 候选人面试页面（录音组件） | 2-3 天 |
| | AI 处理流水线（ASR/LLM/TTS） | 3-4 天 |
| **第 3 周** | HR 后台（面试列表、报告详情） | 3-4 天 |
| | 测试、优化、Bug 修复 | 2-3 天 |

**总计：约 3 周**
