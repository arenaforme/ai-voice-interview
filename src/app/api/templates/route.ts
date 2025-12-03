import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

// 获取面试模板列表（支持筛选）
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const isSystem = searchParams.get('isSystem')
  const isActive = searchParams.get('isActive')
  const search = searchParams.get('search')

  // 构建查询条件
  const where: Record<string, unknown> = {}
  if (isSystem !== null) {
    where.isSystem = isSystem === 'true'
  }
  if (isActive !== null) {
    where.isActive = isActive === 'true'
  }
  if (search) {
    where.name = { contains: search, mode: 'insensitive' }
  }

  const templates = await prisma.interviewTemplate.findMany({
    where,
    orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    include: {
      _count: { select: { positions: true } },
    },
  })

  return NextResponse.json({ data: templates })
}

// 创建自定义模板
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const body = await request.json()
  const { name, description, minQuestions, maxQuestions, dimensions, questionTemplates, systemPrompt } = body

  if (!name || !systemPrompt) {
    return NextResponse.json({ error: '模板名称和系统提示词为必填项' }, { status: 400 })
  }

  // 检查名称是否重复
  const existing = await prisma.interviewTemplate.findUnique({ where: { name } })
  if (existing) {
    return NextResponse.json({ error: '模板名称已存在' }, { status: 400 })
  }

  const template = await prisma.interviewTemplate.create({
    data: {
      name,
      description,
      minQuestions: minQuestions || 5,
      maxQuestions: maxQuestions || 10,
      dimensions: dimensions || ['专业能力', '沟通表达', '逻辑思维', '执行力', '职业动机'],
      questionTemplates,
      systemPrompt,
      isSystem: false,
      isActive: true,
      createdById: session.user.id,
    },
  })

  return NextResponse.json({ data: template }, { status: 201 })
}
