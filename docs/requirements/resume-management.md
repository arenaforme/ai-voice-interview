# 岗位简历管理功能需求文档

## 1. 功能概述

为 HR 提供岗位级别的简历管理功能，支持简历批量上传、AI 智能解析、在线预览、备注管理，并可基于简历快速生成面试链接。所有操作记录日志，便于追溯。

## 2. 已确认决策

| 问题 | 决策 |
|------|------|
| 简历解析 | ✅ 需要 AI 解析简历，自动提取候选人信息 |
| 简历状态 | ❌ 暂不需要简历筛选状态 |
| 批量操作 | ✅ 需要批量上传和批量删除 |
| 在线预览 | ✅ 需要在线预览功能 |
| 权限控制 | ✅ 所有 HR 可删除，记录操作日志 |

## 3. 用户故事

### 3.1 简历管理
- **US-1**: 作为 HR，我可以批量上传候选人简历，系统自动解析提取候选人信息
- **US-2**: 作为 HR，我可以在线预览简历内容，无需下载
- **US-3**: 作为 HR，我可以批量删除不合适的简历
- **US-4**: 作为 HR，我可以为简历添加/编辑备注，记录筛选意见
- **US-5**: 作为 HR，我可以手动修改 AI 解析的候选人信息

### 3.2 面试链接生成
- **US-6**: 作为 HR，我可以从简历直接生成面试链接，系统自动填充候选人信息
- **US-7**: 作为 HR，我仍可以不依赖简历直接生成面试链接（保留原有功能）

## 4. 功能详情

### 4.1 简历上传（支持批量）
| 属性 | 说明 |
|------|------|
| 支持格式 | PDF、DOC、DOCX |
| 文件大小 | 单个最大 10MB |
| 批量上传 | 一次最多 20 份 |
| 存储位置 | MinIO `interview-resumes` bucket |
| 候选人信息 | AI 自动解析（可手动修改） |

### 4.2 简历列表
- **显示字段**：复选框、候选人姓名、手机、邮箱、学历、上传时间、解析状态、面试状态
- **批量操作**：全选/取消全选、批量删除
- **单条操作**：预览、下载、备注、生成面试链接、删除

### 4.3 简历备注
- 支持多条备注（时间线形式）
- 每条备注记录：内容、创建时间、创建人

### 4.4 从简历生成面试链接
- 点击"生成面试链接"按钮
- 自动填充候选人姓名（来自 AI 解析结果）
- 其他流程与现有生成链接功能一致
- 生成后，面试记录关联到该简历

## 5. 简历解析功能

### 5.1 解析字段
| 字段 | 说明 | 示例 |
|------|------|------|
| candidateName | 候选人姓名 | 张三 |
| phone | 手机号码 | 13800138000 |
| email | 电子邮箱 | zhangsan@example.com |
| education | 最高学历 | 本科/硕士/博士 |
| school | 毕业院校 | 北京大学 |
| major | 专业 | 计算机科学 |
| workYears | 工作年限 | 5 |
| expectedSalary | 期望薪资 | 20-30K |
| skills | 技能标签 | ["Java", "Python", "React"] |

### 5.2 解析流程
1. **文本提取**：PDF 使用 `pdf-parse`，DOC/DOCX 使用 `mammoth`
2. **AI 解析**：将文本发送给 Claude API，返回结构化 JSON
3. **状态管理**：PENDING → PARSING → SUCCESS/FAILED
4. **失败处理**：标记失败状态，允许手动编辑或重新解析

### 5.3 解析时机
- 上传后立即异步解析
- 前端轮询解析状态（每 2 秒）
- 解析完成后自动刷新列表

## 6. 批量操作功能

### 6.1 批量上传
- **上传方式**：拖拽多文件或点击多选
- **数量限制**：一次最多 20 份
- **进度显示**：显示每个文件的上传进度和解析状态
- **错误处理**：单个文件失败不影响其他文件，显示失败原因
- **并发控制**：最多 3 个文件同时上传

### 6.2 批量删除
- **多选机制**：表格行前添加复选框
- **全选功能**：表头复选框控制全选/取消全选
- **批量删除按钮**：选中后显示"删除选中(N)"按钮
- **二次确认**：弹窗确认，显示将删除的简历数量和候选人姓名

## 7. 在线预览功能

### 7.1 预览方案
| 格式 | 方案 | 说明 |
|------|------|------|
| PDF | react-pdf | 前端直接渲染 PDF |
| DOC/DOCX | 仅下载 | 暂不支持在线预览，提供下载按钮 |

### 7.2 预览弹窗
- **尺寸**：全屏或 80% 视口
- **功能**：缩放、翻页、下载
- **加载状态**：显示加载动画

## 8. 操作日志功能

### 8.1 记录的操作类型
| 操作类型 | 说明 |
|----------|------|
| UPLOAD | 上传简历 |
| DELETE | 删除简历 |
| BATCH_DELETE | 批量删除简历 |
| ADD_NOTE | 添加备注 |
| DELETE_NOTE | 删除备注 |
| EDIT_INFO | 编辑候选人信息 |
| GENERATE_INTERVIEW | 生成面试链接 |
| REPARSE | 重新解析简历 |

### 8.2 日志字段
- 操作类型、操作人、操作时间、简历ID、操作详情（JSON）

## 9. 数据模型

### 9.1 新增表：Resume（简历）
```prisma
model Resume {
  id              String   @id @default(cuid())

  // 文件信息
  fileName        String   // 原始文件名
  fileKey         String   // MinIO 存储 key
  fileSize        Int      // 文件大小（字节）
  mimeType        String   // 文件类型

  // AI 解析字段
  candidateName   String?  // 候选人姓名
  phone           String?  // 手机号
  email           String?  // 邮箱
  education       String?  // 学历
  school          String?  // 毕业院校
  major           String?  // 专业
  workYears       Int?     // 工作年限
  expectedSalary  String?  // 期望薪资
  skills          Json?    // 技能标签 ["Java", "Python"]
  rawText         String?  @db.Text // 简历原文（用于重新解析）
  parseStatus     String   @default("PENDING") // PENDING/PARSING/SUCCESS/FAILED
  parseError      String?  // 解析失败原因

  // 关联
  positionId      String
  position        Position @relation(fields: [positionId], references: [id])
  createdById     String
  createdBy       User     @relation("ResumeCreatedBy", fields: [createdById], references: [id])

  interviews      Interview[]
  notes           ResumeNote[]
  logs            ResumeLog[]

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### 9.2 新增表：ResumeNote（简历备注）
```prisma
model ResumeNote {
  id          String   @id @default(cuid())
  content     String   @db.Text

  resumeId    String
  resume      Resume   @relation(fields: [resumeId], references: [id], onDelete: Cascade)
  createdById String
  createdBy   User     @relation("ResumeNoteCreatedBy", fields: [createdById], references: [id])

  createdAt   DateTime @default(now())
}
```

### 9.3 新增表：ResumeLog（操作日志）
```prisma
model ResumeLog {
  id          String   @id @default(cuid())
  action      String   // UPLOAD/DELETE/ADD_NOTE/...
  details     Json?    // 操作详情

  resumeId    String?  // 删除后可能为空
  resume      Resume?  @relation(fields: [resumeId], references: [id], onDelete: SetNull)
  operatorId  String
  operator    User     @relation("ResumeLogOperator", fields: [operatorId], references: [id])

  createdAt   DateTime @default(now())
}
```

### 9.4 修改表：Interview
```prisma
model Interview {
  // ... 现有字段
  resumeId    String?  // 新增：关联简历（可选）
  resume      Resume?  @relation(fields: [resumeId], references: [id])
}
```

## 10. API 设计

### 10.1 简历管理 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/positions/[id]/resumes` | 获取岗位下的简历列表 |
| POST | `/api/positions/[id]/resumes` | 上传简历（支持批量，multipart/form-data） |
| GET | `/api/resumes/[id]` | 获取简历详情（含解析信息） |
| PATCH | `/api/resumes/[id]` | 更新简历信息（手动编辑解析结果） |
| DELETE | `/api/resumes/[id]` | 删除简历 |
| POST | `/api/resumes/batch-delete` | 批量删除简历 |
| GET | `/api/resumes/[id]/download` | 下载简历文件 |
| GET | `/api/resumes/[id]/preview` | 获取预览 URL（PDF） |
| POST | `/api/resumes/[id]/reparse` | 重新解析简历 |

### 10.2 简历备注 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/resumes/[id]/notes` | 获取简历备注列表 |
| POST | `/api/resumes/[id]/notes` | 添加备注 |
| DELETE | `/api/resumes/[id]/notes/[noteId]` | 删除备注 |

### 10.3 面试链接生成 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/resumes/[id]/interview` | 从简历生成面试链接 |

### 10.4 操作日志 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/resumes/[id]/logs` | 获取简历操作日志 |

## 11. UI 设计

### 11.1 岗位详情页改造
```
岗位详情页
├── 基本信息卡片（现有）
├── 面试链接管理卡片（现有）
│   └── [生成面试链接] 按钮（保留）
└── 简历管理卡片（新增）
    ├── 标题栏：简历管理 (N份) + [批量上传] 按钮
    ├── 批量操作栏（选中时显示）：已选 N 份 [删除选中] [取消选择]
    └── 简历列表表格
        ├── [☐] 复选框
        ├── 候选人姓名
        ├── 手机号
        ├── 邮箱
        ├── 学历
        ├── 上传时间
        ├── 解析状态（解析中/成功/失败）
        ├── 面试状态（未面试/已生成链接/已完成）
        └── 操作：[预览] [备注] [生成链接] [删除]
```

### 11.2 批量上传弹窗
```
┌─────────────────────────────────────────┐
│ 批量上传简历                        [X] │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐    │
│  │                                 │    │
│  │     拖拽文件到此处或点击上传     │    │
│  │                                 │    │
│  │  支持 PDF、DOC、DOCX，最大 10MB  │    │
│  │       一次最多上传 20 份         │    │
│  │                                 │    │
│  └─────────────────────────────────┘    │
│                                         │
│  上传队列 (3/5)                         │
│  ┌─────────────────────────────────┐    │
│  │ ✓ 张三_简历.pdf      已完成     │    │
│  │ ✓ 李四_简历.pdf      解析中...  │    │
│  │ ◐ 王五_简历.docx     上传中 60% │    │
│  │ ○ 赵六_简历.pdf      等待中     │    │
│  │ ✗ 钱七_简历.doc      格式错误   │    │
│  └─────────────────────────────────┘    │
│                                         │
│              [取消] [完成]              │
└─────────────────────────────────────────┘
```

### 11.3 简历预览弹窗
```
┌─────────────────────────────────────────────────┐
│ 简历预览 - 张三                     [下载] [X]  │
├─────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────┐    │
│  │                                         │    │
│  │                                         │    │
│  │              PDF 预览区域               │    │
│  │                                         │    │
│  │                                         │    │
│  └─────────────────────────────────────────┘    │
│                                                 │
│           [−] [100%] [+]    < 1/3 >             │
└─────────────────────────────────────────────────┘
```

### 11.4 候选人信息编辑弹窗
```
┌─────────────────────────────────────────┐
│ 编辑候选人信息                      [X] │
├─────────────────────────────────────────┤
│ 姓名 *           手机号                 │
│ [张三_______]    [13800138000___]       │
│                                         │
│ 邮箱             学历                   │
│ [zhang@xx.com]   [本科________▼]       │
│                                         │
│ 毕业院校         专业                   │
│ [北京大学___]    [计算机科学__]         │
│                                         │
│ 工作年限         期望薪资               │
│ [5_________]     [20-30K_____]          │
│                                         │
│ 技能标签                                │
│ [Java] [Python] [React] [+添加]         │
│                                         │
│              [取消] [保存]              │
└─────────────────────────────────────────┘
```

### 11.5 备注管理弹窗
```
┌─────────────────────────────────────────┐
│ 简历备注 - 张三                     [X] │
├─────────────────────────────────────────┤
│ 添加备注                                │
│ [____________________________] [添加]   │
│                                         │
│ 历史备注                                │
│ ┌─────────────────────────────────────┐ │
│ │ 2024-01-15 14:30 - admin            │ │
│ │ 技术背景不错，建议面试              │ │
│ │                               [删除] │ │
│ └─────────────────────────────────────┘ │
│ ┌─────────────────────────────────────┐ │
│ │ 2024-01-14 10:00 - admin            │ │
│ │ 简历已收到                          │ │
│ │                               [删除] │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### 11.6 批量删除确认弹窗
```
┌─────────────────────────────────────────┐
│ ⚠️ 确认删除                          [X] │
├─────────────────────────────────────────┤
│                                         │
│  确定要删除以下 3 份简历吗？            │
│                                         │
│  • 张三                                 │
│  • 李四                                 │
│  • 王五                                 │
│                                         │
│  此操作不可恢复！                       │
│                                         │
│           [取消] [确认删除]             │
└─────────────────────────────────────────┘
```

## 12. 技术方案

### 12.1 文件上传流程（批量）
1. 前端选择多个文件，校验格式和大小
2. 并发控制：最多 3 个文件同时上传
3. 调用 `/api/positions/[id]/resumes` POST 接口（每个文件单独请求）
4. 后端生成唯一 fileKey，上传到 MinIO
5. 创建 Resume 记录（parseStatus = PENDING）
6. 异步触发简历解析任务
7. 前端轮询解析状态

### 12.2 简历解析流程
1. 从 MinIO 获取文件
2. 文本提取：
   - PDF：使用 `pdf-parse` 库
   - DOC/DOCX：使用 `mammoth` 库
3. 调用 Claude API 进行结构化解析
4. 更新 Resume 记录（解析字段 + parseStatus）
5. 记录操作日志

### 12.3 文件预览流程
1. 调用 `/api/resumes/[id]/preview`
2. 后端生成 MinIO 预签名 URL（有效期 1 小时）
3. 前端使用 react-pdf 渲染 PDF

### 12.4 文件下载流程
1. 调用 `/api/resumes/[id]/download`
2. 后端从 MinIO 获取文件
3. 返回文件流，设置 Content-Disposition

### 12.5 MinIO Bucket 配置
- Bucket 名称：`interview-resumes`
- 访问策略：私有（通过 API 代理访问）

### 12.6 依赖库
| 库名 | 用途 | 版本 |
|------|------|------|
| pdf-parse | PDF 文本提取 | ^1.1.1 |
| mammoth | DOC/DOCX 文本提取 | ^1.6.0 |
| react-pdf | PDF 前端渲染 | ^7.7.0 |

## 13. 开发任务拆分

### 阶段一：基础设施
1. 数据库迁移：新增 Resume、ResumeNote、ResumeLog 表，修改 Interview 表
2. MinIO 配置：创建 `interview-resumes` bucket
3. 安装依赖：pdf-parse、mammoth、react-pdf

### 阶段二：后端 API
4. 简历上传 API（支持批量）
5. 简历列表/详情/删除/批量删除 API
6. 简历信息编辑 API
7. 简历预览/下载 API
8. 简历解析服务（Claude API 集成）
9. 简历备注 CRUD API
10. 操作日志记录服务
11. 从简历生成面试链接 API

### 阶段三：前端页面
12. 岗位详情页简历管理卡片
13. 简历列表组件（含多选、批量操作）
14. 批量上传弹窗组件
15. 简历预览弹窗组件
16. 候选人信息编辑弹窗
17. 备注管理弹窗组件
18. 批量删除确认弹窗

### 阶段四：测试与优化
19. 单元测试：API 接口测试
20. 集成测试：完整流程测试
21. 性能优化：大文件上传、解析队列

---

**文档版本**：v2.0
**创建日期**：2024-12-03
**更新日期**：2024-12-03
**状态**：待用户确认
