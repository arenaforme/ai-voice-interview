import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

interface RouteParams {
  params: Promise<{ id: string }>
}

// 复制模板
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { id } = await params

  const template = await prisma.interviewTemplate.findUnique({ where: { id } })
  if (!template) {
    return NextResponse.json({ error: '模板不存在' }, { status: 404 })
  }

  // 生成新名称，确保唯一
  let newName = `${template.name}-副本`
  let counter = 1
  while (await prisma.interviewTemplate.findUnique({ where: { name: newName } })) {
    counter++
    newName = `${template.name}-副本${counter}`
  }

  const copied = await prisma.interviewTemplate.create({
    data: {
      name: newName,
      description: template.description,
      minQuestions: template.minQuestions,
      maxQuestions: template.maxQuestions,
      dimensions: template.dimensions as object,
      questionTemplates: template.questionTemplates as object | undefined,
      systemPrompt: template.systemPrompt,
      isSystem: false,
      isActive: true,
      createdById: session.user.id,
    },
  })

  return NextResponse.json({ data: copied }, { status: 201 })
}
