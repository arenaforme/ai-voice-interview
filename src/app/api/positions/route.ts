import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

// 获取岗位列表
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const positions = await prisma.position.findMany({
    where: { createdById: session.user.id },
    include: {
      template: true,
      _count: { select: { interviews: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ data: positions })
}

// 创建岗位
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const body = await request.json()
  const { name, description, templateId } = body

  if (!name || !templateId) {
    return NextResponse.json({ error: '缺少必填字段' }, { status: 400 })
  }

  const position = await prisma.position.create({
    data: {
      name,
      description,
      templateId,
      createdById: session.user.id,
    },
    include: { template: true },
  })

  return NextResponse.json({ data: position }, { status: 201 })
}
