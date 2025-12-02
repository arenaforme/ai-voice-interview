import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'

interface RouteParams {
  params: Promise<{ id: string }>
}

interface QuestionTemplate {
  dimension: string
  sampleQuestions: string[]
}

// 更新问题模板
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { questionTemplates } = body as { questionTemplates: QuestionTemplate[] }

  // 校验数据
  if (!Array.isArray(questionTemplates)) {
    return NextResponse.json({ error: '无效的问题模板格式' }, { status: 400 })
  }

  for (const tpl of questionTemplates) {
    if (!tpl.dimension || !Array.isArray(tpl.sampleQuestions)) {
      return NextResponse.json({ error: '每个维度必须包含 dimension 和 sampleQuestions' }, { status: 400 })
    }
    if (tpl.sampleQuestions.length === 0) {
      return NextResponse.json({ error: `维度 "${tpl.dimension}" 至少需要一个示例问题` }, { status: 400 })
    }
  }

  const template = await prisma.interviewTemplate.findUnique({
    where: { id },
  })

  if (!template) {
    return NextResponse.json({ error: '模板不存在' }, { status: 404 })
  }

  const updated = await prisma.interviewTemplate.update({
    where: { id },
    data: { questionTemplates: questionTemplates as unknown as Prisma.InputJsonValue },
  })

  return NextResponse.json({ data: updated })
}
