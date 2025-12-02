import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { nanoid } from 'nanoid'

// 获取面试列表
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const positionId = searchParams.get('positionId')
  const status = searchParams.get('status')

  const where: Record<string, unknown> = {
    position: { createdById: session.user.id },
  }

  if (positionId) where.positionId = positionId
  if (status) where.status = status

  const interviews = await prisma.interview.findMany({
    where,
    include: {
      position: true,
      rounds: true,
      report: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json({ data: interviews })
}

// 创建面试（生成面试链接）
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const body = await request.json()
  const { positionId, candidateName, candidateEmail, candidatePhone } = body

  if (!positionId || !candidateName) {
    return NextResponse.json({ error: '缺少必填字段' }, { status: 400 })
  }

  // 验证岗位归属
  const position = await prisma.position.findFirst({
    where: { id: positionId, createdById: session.user.id },
    include: { template: true },
  })

  if (!position) {
    return NextResponse.json({ error: '岗位不存在' }, { status: 404 })
  }

  // 生成唯一 token
  const token = nanoid(32)

  const interview = await prisma.interview.create({
    data: {
      token,
      positionId,
      candidateName,
      candidateEmail,
      candidatePhone,
      maxRounds: position.template.questionCount,
    },
    include: { position: true },
  })

  return NextResponse.json({ data: interview }, { status: 201 })
}
