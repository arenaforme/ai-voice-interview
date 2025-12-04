import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { getResumeUrl } from '@/lib/storage/resume-storage'

// GET: 获取简历预览 URL
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
      select: { fileKey: true, mimeType: true, fileName: true },
    })

    if (!resume) {
      return NextResponse.json({ error: '简历不存在' }, { status: 404 })
    }

    // 只支持 PDF 预览
    if (resume.mimeType !== 'application/pdf') {
      return NextResponse.json(
        { error: '仅支持 PDF 文件预览，请下载查看' },
        { status: 400 }
      )
    }

    // 生成预签名 URL（有效期 1 小时）
    const url = await getResumeUrl(resume.fileKey, 3600)

    return NextResponse.json({ url, fileName: resume.fileName })
  } catch (error) {
    console.error('获取预览 URL 失败:', error)
    return NextResponse.json({ error: '获取预览 URL 失败' }, { status: 500 })
  }
}
