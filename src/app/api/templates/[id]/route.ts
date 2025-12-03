import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

interface RouteParams {
  params: Promise<{ id: string }>
}

// 获取模板详情
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { id } = await params

  const template = await prisma.interviewTemplate.findUnique({
    where: { id },
    include: {
      _count: { select: { positions: true } },
    },
  })

  if (!template) {
    return NextResponse.json({ error: '模板不存在' }, { status: 404 })
  }

  return NextResponse.json({ data: template })
}

// 更新模板
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()

  const template = await prisma.interviewTemplate.findUnique({ where: { id } })
  if (!template) {
    return NextResponse.json({ error: '模板不存在' }, { status: 404 })
  }

  // 系统模板只能修改 questionTemplates 和 isActive
  if (template.isSystem) {
    const { questionTemplates, isActive } = body
    const updated = await prisma.interviewTemplate.update({
      where: { id },
      data: {
        ...(questionTemplates !== undefined && { questionTemplates }),
        ...(isActive !== undefined && { isActive }),
      },
    })
    return NextResponse.json({ data: updated })
  }

  // 自定义模板可以修改所有字段
  const { name, description, minQuestions, maxQuestions, dimensions, questionTemplates, systemPrompt, isActive } = body

  // 检查名称是否与其他模板重复
  if (name && name !== template.name) {
    const existing = await prisma.interviewTemplate.findUnique({ where: { name } })
    if (existing) {
      return NextResponse.json({ error: '模板名称已存在' }, { status: 400 })
    }
  }

  const updated = await prisma.interviewTemplate.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(description !== undefined && { description }),
      ...(minQuestions && { minQuestions }),
      ...(maxQuestions && { maxQuestions }),
      ...(dimensions && { dimensions }),
      ...(questionTemplates !== undefined && { questionTemplates }),
      ...(systemPrompt && { systemPrompt }),
      ...(isActive !== undefined && { isActive }),
    },
  })

  return NextResponse.json({ data: updated })
}

// 删除模板
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { id } = await params

  const template = await prisma.interviewTemplate.findUnique({
    where: { id },
    include: { _count: { select: { positions: true } } },
  })

  if (!template) {
    return NextResponse.json({ error: '模板不存在' }, { status: 404 })
  }

  // 系统模板不能删除
  if (template.isSystem) {
    return NextResponse.json({ error: '系统模板不能删除' }, { status: 400 })
  }

  // 已被岗位使用的模板不能删除
  if (template._count.positions > 0) {
    return NextResponse.json({ error: '该模板已被岗位使用，无法删除' }, { status: 400 })
  }

  await prisma.interviewTemplate.delete({ where: { id } })

  return NextResponse.json({ message: '删除成功' })
}
