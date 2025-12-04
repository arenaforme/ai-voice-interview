import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/db/prisma'

/**
 * 获取简历关联的所有面试记录
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { id: resumeId } = await params

    const interviews = await prisma.interview.findMany({
      where: { resumeId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        token: true,
        candidateName: true,
        status: true,
        createdAt: true,
        completedAt: true,
      },
    })

    return NextResponse.json({ data: interviews })
  } catch (error) {
    console.error('获取简历面试记录失败:', error)
    return NextResponse.json({ error: '获取失败' }, { status: 500 })
  }
}
