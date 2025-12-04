import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { uploadResume } from '@/lib/storage/resume-storage'
import { parseResume } from '@/lib/ai/resume-parser'
import { logResumeAction } from '@/lib/services/resume-log'
import { nanoid } from 'nanoid'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

// GET: 获取岗位下的简历列表
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { id: positionId } = await params

    const resumes = await prisma.resume.findMany({
      where: { positionId },
      include: {
        createdBy: { select: { id: true, name: true } },
        interviews: { select: { id: true, status: true } },
        notes: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: { createdBy: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(resumes)
  } catch (error) {
    console.error('获取简历列表失败:', error)
    return NextResponse.json({ error: '获取简历列表失败' }, { status: 500 })
  }
}

// POST: 上传简历
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: '未授权' }, { status: 401 })
    }

    const { id: positionId } = await params

    // 验证岗位存在
    const position = await prisma.position.findUnique({
      where: { id: positionId },
    })
    if (!position) {
      return NextResponse.json({ error: '岗位不存在' }, { status: 404 })
    }

    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: '请选择文件' }, { status: 400 })
    }

    const results = []
    const errors = []

    for (const file of files) {
      // 验证文件类型
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push({ fileName: file.name, error: '不支持的文件格式' })
        continue
      }

      // 验证文件大小
      if (file.size > MAX_FILE_SIZE) {
        errors.push({ fileName: file.name, error: '文件大小超过 10MB' })
        continue
      }

      try {
        // 读取文件内容
        const buffer = Buffer.from(await file.arrayBuffer())
        const fileKey = `${positionId}/${nanoid()}-${file.name}`

        // 上传到 MinIO
        await uploadResume(fileKey, buffer, file.type)

        // 创建简历记录
        const resume = await prisma.resume.create({
          data: {
            fileName: file.name,
            fileKey,
            fileSize: file.size,
            mimeType: file.type,
            positionId,
            createdById: session.user.id,
            parseStatus: 'PENDING',
          },
        })

        // 记录操作日志
        await logResumeAction('UPLOAD', session.user.id, resume.id, {
          fileName: file.name,
          fileSize: file.size,
        })

        // 异步解析简历
        parseResumeAsync(resume.id, buffer, file.type)

        results.push(resume)
      } catch (err) {
        errors.push({
          fileName: file.name,
          error: err instanceof Error ? err.message : '上传失败',
        })
      }
    }

    if (results.length === 0) {
      return NextResponse.json(
        { error: '所有文件上传失败', details: errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ resumes: results, errors }, { status: 201 })
  } catch (error) {
    console.error('上传简历失败:', error)
    return NextResponse.json({ error: '上传简历失败' }, { status: 500 })
  }
}

// 异步解析简历
async function parseResumeAsync(
  resumeId: string,
  buffer: Buffer,
  mimeType: string
) {
  try {
    // 更新状态为解析中
    await prisma.resume.update({
      where: { id: resumeId },
      data: { parseStatus: 'PARSING' },
    })

    // 解析简历
    const { rawText, parsed } = await parseResume(buffer, mimeType)

    // 更新解析结果
    await prisma.resume.update({
      where: { id: resumeId },
      data: {
        rawText,
        candidateName: parsed.candidateName,
        phone: parsed.phone,
        email: parsed.email,
        education: parsed.education,
        school: parsed.school,
        major: parsed.major,
        workYears: parsed.workYears,
        expectedSalary: parsed.expectedSalary,
        skills: parsed.skills,
        parseStatus: 'SUCCESS',
      },
    })
  } catch (error) {
    console.error('解析简历失败:', error)
    await prisma.resume.update({
      where: { id: resumeId },
      data: {
        parseStatus: 'FAILED',
        parseError: error instanceof Error ? error.message : '解析失败',
      },
    })
  }
}
