# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

AI 语音面试系统（HR 初筛版）- 一个基于 Web 的 AI 语音面试平台，用于 HR 初筛候选人。

### 核心功能

- HR 后台：岗位管理、面试链接生成、面试报告查看
- 候选人端：Web 语音面试（一问一答模式）
- AI 处理：ASR 语音转文字 → LLM 分析评分 → TTS 语音合成

### 目标岗位

项目经理、产品经理、销售人员（预置 3 套面试模板）

## 技术栈

- **前端**：Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
- **后端**：Next.js API Routes + Prisma ORM
- **数据库**：PostgreSQL
- **缓存**：Redis
- **存储**：MinIO（录音文件）
- **AI 服务**：
  - ASR：OpenAI Whisper API
  - LLM：Anthropic Claude API
  - TTS：OpenAI TTS API
- **部署**：Docker Compose

## 常用命令

### 本地开发

```bash
# 启动基础设施
docker-compose up -d postgres redis minio

# 安装依赖
npm install

# 数据库迁移
npx prisma migrate dev

# 启动开发服务器
npm run dev
```

### Docker 部署

```bash
# 生成 SSL 证书（首次）
mkdir -p docker/nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout docker/nginx/ssl/key.pem \
  -out docker/nginx/ssl/cert.pem \
  -subj "/CN=localhost"

# 构建并启动
docker-compose up -d --build

# 数据库迁移
docker-compose exec app npx prisma migrate deploy
```

### 其他命令

```bash
npm run db:generate    # 生成 Prisma 客户端
npm run db:migrate     # 数据库迁移（开发）
npm run db:seed        # 初始化种子数据
npm run db:studio      # 数据库管理界面
npm run build          # 生产构建
npm run lint           # 代码检查
```

## 项目结构

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   │   ├── auth/          # NextAuth.js 认证
│   │   ├── positions/     # 岗位管理 API
│   │   ├── interviews/    # 面试管理 API (HR)
│   │   ├── interview/     # 候选人面试 API
│   │   └── templates/     # 面试模板 API
│   ├── dashboard/         # HR 后台页面
│   ├── interview/         # 候选人面试页面
│   └── login/             # 登录页面
├── components/            # UI 组件
│   └── ui/               # shadcn/ui 组件
├── hooks/                 # React Hooks
├── lib/                   # 工具库
│   ├── ai/               # AI 服务封装
│   ├── auth/             # 认证配置
│   ├── db/               # 数据库客户端
│   └── storage/          # MinIO 存储
└── types/                 # TypeScript 类型定义

prisma/
├── schema.prisma          # 数据库模型
└── seed.ts               # 种子数据
```

## 默认账号

初始化种子数据后可使用：
- 邮箱：admin@example.com
- 密码：admin123

## 关键业务流程

```
HR 生成链接 → 候选人打开 → 授权麦克风 → AI 语音提问 → 候选人语音回答
→ ASR 转写 → LLM 评分 → 生成下一题/结束 → 输出面试报告
```

## 能力评估维度

1. 专业能力（项目/产品/销售）
2. 沟通表达
3. 逻辑思维与问题分析
4. 执行与结果导向
5. 职业动机与稳定性

## 性能要求

- 单题处理时间（ASR + LLM + TTS）：3-8 秒
- 并发面试数：10-50 场
- 每题最长回答时间：90 秒
