import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { logResumeAction } from '@/lib/services/resume-log'

// DELETE: 删除备注
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { id: resumeId, noteId } = await params

    const note = await prisma.resumeNote.findUnique({
      where: { id: noteId },
    })

    if (!note || note.resumeId !== resumeId) {
      return NextResponse.json({ error: '备注不存在' }, { status: 404 })
    }

    await prisma.resumeNote.delete({ where: { id: noteId } })

    await logResumeAction('DELETE_NOTE', session.user.id, resumeId, {
      noteId,
      content: note.content,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除备注失败:', error)
    return NextResponse.json({ error: '删除备注失败' }, { status: 500 })
  }
}
