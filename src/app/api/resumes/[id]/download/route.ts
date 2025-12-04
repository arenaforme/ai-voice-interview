import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import { getResumeBuffer } from '@/lib/storage/resume-storage'

// GET: 下载简历文件
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

    // 获取文件内容
    const buffer = await getResumeBuffer(resume.fileKey)

    // 返回文件流
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': resume.mimeType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(resume.fileName)}`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error) {
    console.error('下载简历失败:', error)
    return NextResponse.json({ error: '下载简历失败' }, { status: 500 })
  }
}
