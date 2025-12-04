import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { nanoid } from 'nanoid'
import { logResumeAction } from '@/lib/services/resume-log'

// POST: 从简历生成面试链接
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

    // 获取简历信息
    const resume = await prisma.resume.findUnique({
      where: { id: resumeId },
      include: {
        position: { include: { template: true } },
      },
    })

    if (!resume) {
      return NextResponse.json({ error: '简历不存在' }, { status: 404 })
    }

    // 使用解析出的候选人姓名，如果没有则使用文件名
    const candidateName = resume.candidateName || resume.fileName.replace(/\.[^/.]+$/, '')

    // 生成唯一 token
    const token = nanoid(32)

    // 创建面试记录
    const interview = await prisma.interview.create({
      data: {
        token,
        positionId: resume.positionId,
        candidateName,
        candidateEmail: resume.email,
        candidatePhone: resume.phone,
        minRounds: resume.position.template.minQuestions,
        maxRounds: resume.position.template.maxQuestions,
        resumeId,
      },
      include: { position: true },
    })

    // 记录操作日志
    await logResumeAction('GENERATE_INTERVIEW', session.user.id, resumeId, {
      interviewId: interview.id,
      token: interview.token,
      candidateName,
    })

    return NextResponse.json({ data: interview }, { status: 201 })
  } catch (error) {
    console.error('从简历生成面试链接失败:', error)
    return NextResponse.json({ error: '生成面试链接失败' }, { status: 500 })
  }
}
