import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

// 获取面试模板列表
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const templates = await prisma.interviewTemplate.findMany({
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ data: templates })
}
