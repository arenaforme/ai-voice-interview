import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

interface RouteParams {
  params: Promise<{ id: string }>
}

// 获取单个岗位
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { id } = await params
  const position = await prisma.position.findFirst({
    where: { id, createdById: session.user.id },
    include: {
      template: true,
      interviews: {
        include: { rounds: true, report: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!position) {
    return NextResponse.json({ error: '岗位不存在' }, { status: 404 })
  }

  return NextResponse.json({ data: position })
}

// 更新岗位
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { name, description, status } = body

  const position = await prisma.position.updateMany({
    where: { id, createdById: session.user.id },
    data: { name, description, status },
  })

  if (position.count === 0) {
    return NextResponse.json({ error: '岗位不存在' }, { status: 404 })
  }

  const updated = await prisma.position.findUnique({
    where: { id },
    include: { template: true },
  })

  return NextResponse.json({ data: updated })
}

// 删除岗位
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { id } = await params
  const position = await prisma.position.deleteMany({
    where: { id, createdById: session.user.id },
  })

  if (position.count === 0) {
    return NextResponse.json({ error: '岗位不存在' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
