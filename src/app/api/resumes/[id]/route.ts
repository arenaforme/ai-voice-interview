import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { deleteResume } from '@/lib/storage/resume-storage'
import { logResumeAction } from '@/lib/services/resume-log'

// GET: 获取简历详情
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { id } = await params

    const resume = await prisma.resume.findUnique({
      where: { id },
      include: {
        position: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        interviews: { select: { id: true, status: true, candidateName: true } },
        notes: {
          include: { createdBy: { select: { name: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!resume) {
      return NextResponse.json({ error: '简历不存在' }, { status: 404 })
    }

    return NextResponse.json(resume)
  } catch (error) {
    console.error('获取简历详情失败:', error)
    return NextResponse.json({ error: '获取简历详情失败' }, { status: 500 })
  }
}

// PATCH: 更新简历信息（手动编辑解析结果）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const resume = await prisma.resume.findUnique({ where: { id } })
    if (!resume) {
      return NextResponse.json({ error: '简历不存在' }, { status: 404 })
    }

    const updatedResume = await prisma.resume.update({
      where: { id },
      data: {
        candidateName: body.candidateName,
        phone: body.phone,
        email: body.email,
        education: body.education,
        school: body.school,
        major: body.major,
        workYears: body.workYears,
        expectedSalary: body.expectedSalary,
        skills: body.skills,
      },
    })

    await logResumeAction('EDIT_INFO', session.user.id, id, {
      changes: body,
    })

    return NextResponse.json(updatedResume)
  } catch (error) {
    console.error('更新简历失败:', error)
    return NextResponse.json({ error: '更新简历失败' }, { status: 500 })
  }
}

// DELETE: 删除简历
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { id } = await params

    const resume = await prisma.resume.findUnique({ where: { id } })
    if (!resume) {
      return NextResponse.json({ error: '简历不存在' }, { status: 404 })
    }

    // 记录日志（在删除前记录）
    await logResumeAction('DELETE', session.user.id, id, {
      fileName: resume.fileName,
      candidateName: resume.candidateName,
    })

    // 删除 MinIO 文件
    try {
      await deleteResume(resume.fileKey)
    } catch (e) {
      console.error('删除 MinIO 文件失败:', e)
    }

    // 删除数据库记录
    await prisma.resume.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除简历失败:', error)
    return NextResponse.json({ error: '删除简历失败' }, { status: 500 })
  }
}
