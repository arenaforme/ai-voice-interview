import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { deleteResumes } from '@/lib/storage/resume-storage'
import { logResumeAction } from '@/lib/services/resume-log'

// POST: 批量删除简历
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { ids } = await request.json()

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: '请选择要删除的简历' }, { status: 400 })
    }

    // 获取要删除的简历信息
    const resumes = await prisma.resume.findMany({
      where: { id: { in: ids } },
      select: { id: true, fileKey: true, fileName: true, candidateName: true },
    })

    if (resumes.length === 0) {
      return NextResponse.json({ error: '未找到要删除的简历' }, { status: 404 })
    }

    // 记录批量删除日志
    await logResumeAction('BATCH_DELETE', session.user.id, null, {
      count: resumes.length,
      resumes: resumes.map((r) => ({
        id: r.id,
        fileName: r.fileName,
        candidateName: r.candidateName,
      })),
    })

    // 删除 MinIO 文件
    const fileKeys = resumes.map((r) => r.fileKey)
    try {
      await deleteResumes(fileKeys)
    } catch (e) {
      console.error('批量删除 MinIO 文件失败:', e)
    }

    // 删除数据库记录
    await prisma.resume.deleteMany({
      where: { id: { in: ids } },
    })

    return NextResponse.json({
      success: true,
      deletedCount: resumes.length,
    })
  } catch (error) {
    console.error('批量删除简历失败:', error)
    return NextResponse.json({ error: '批量删除简历失败' }, { status: 500 })
  }
}
