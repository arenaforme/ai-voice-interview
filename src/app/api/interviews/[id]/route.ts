import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

interface RouteParams {
  params: Promise<{ id: string }>
}

// 获取面试详情
export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { id } = await params
  const interview = await prisma.interview.findFirst({
    where: {
      id,
      position: { createdById: session.user.id },
    },
    include: {
      position: { include: { template: true } },
      rounds: { orderBy: { roundNumber: 'asc' } },
      report: true,
    },
  })

  if (!interview) {
    return NextResponse.json({ error: '面试不存在' }, { status: 404 })
  }

  return NextResponse.json({ data: interview })
}

// 更新面试（HR 决策）
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const { hrDecision, hrComment } = body

  const interview = await prisma.interview.updateMany({
    where: {
      id,
      position: { createdById: session.user.id },
    },
    data: { hrDecision, hrComment },
  })

  if (interview.count === 0) {
    return NextResponse.json({ error: '面试不存在' }, { status: 404 })
  }

  const updated = await prisma.interview.findUnique({
    where: { id },
    include: { position: true, report: true },
  })

  return NextResponse.json({ data: updated })
}
