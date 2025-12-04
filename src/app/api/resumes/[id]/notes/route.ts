import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { logResumeAction } from '@/lib/services/resume-log'

// GET: 获取简历备注列表
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

    const notes = await prisma.resumeNote.findMany({
      where: { resumeId },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(notes)
  } catch (error) {
    console.error('获取备注列表失败:', error)
    return NextResponse.json({ error: '获取备注列表失败' }, { status: 500 })
  }
}

// POST: 添加备注
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { id: resumeId } = await params
    const { content } = await request.json()

    if (!content?.trim()) {
      return NextResponse.json({ error: '备注内容不能为空' }, { status: 400 })
    }

    // 验证简历存在
    const resume = await prisma.resume.findUnique({ where: { id: resumeId } })
    if (!resume) {
      return NextResponse.json({ error: '简历不存在' }, { status: 404 })
    }

    const note = await prisma.resumeNote.create({
      data: {
        content: content.trim(),
        resumeId,
        createdById: session.user.id,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    })

    await logResumeAction('ADD_NOTE', session.user.id, resumeId, {
      noteId: note.id,
      content: content.trim(),
    })

    return NextResponse.json(note, { status: 201 })
  } catch (error) {
    console.error('添加备注失败:', error)
    return NextResponse.json({ error: '添加备注失败' }, { status: 500 })
  }
}
