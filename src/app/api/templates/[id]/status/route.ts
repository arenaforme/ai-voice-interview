import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

interface RouteParams {
  params: Promise<{ id: string }>
}

// 切换模板状态
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { id } = await params

  const template = await prisma.interviewTemplate.findUnique({ where: { id } })
  if (!template) {
    return NextResponse.json({ error: '模板不存在' }, { status: 404 })
  }

  const updated = await prisma.interviewTemplate.update({
    where: { id },
    data: { isActive: !template.isActive },
  })

  return NextResponse.json({ data: updated })
}
