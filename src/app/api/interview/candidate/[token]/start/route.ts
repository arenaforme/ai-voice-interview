import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { generateQuestion } from '@/lib/ai/llm'
import { synthesizeSpeech } from '@/lib/ai/tts'
import { uploadAudio, getAudioUrl } from '@/lib/storage/minio'

interface RouteParams {
  params: Promise<{ token: string }>
}

// 开始面试
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { token } = await params

  const interview = await prisma.interview.findUnique({
    where: { token },
    include: {
      position: { include: { template: true } },
      rounds: true,
    },
  })

  if (!interview) {
    return NextResponse.json({ error: '面试链接无效' }, { status: 404 })
  }

  if (interview.status === 'COMPLETED') {
    return NextResponse.json({ error: '面试已结束' }, { status: 400 })
  }

  // 如果已有问题，返回当前问题
  if (interview.rounds.length > 0) {
    const lastRound = interview.rounds[interview.rounds.length - 1]
    if (!lastRound.answerText) {
      const audioUrl = lastRound.questionAudioUrl
        ? await getAudioUrl(lastRound.questionAudioUrl.replace(/^\/[^/]+\//, ''))
        : null

      return NextResponse.json({
        data: {
          question: {
            roundNumber: lastRound.roundNumber,
            questionText: lastRound.questionText,
            questionAudioUrl: audioUrl,
            dimension: lastRound.dimension,
          },
        },
      })
    }
  }

  // 更新面试状态
  if (interview.status === 'PENDING') {
    await prisma.interview.update({
      where: { id: interview.id },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    })
  }

  // 生成第一个问题
  const template = interview.position.template
  const dimensions = template.dimensions as string[]
  const dimension = dimensions[0] || '综合能力'

  const questionText = await generateQuestion(
    interview.position.name,
    template.systemPrompt,
    dimension,
    []
  )

  // 生成语音
  const audioBuffer = await synthesizeSpeech(questionText)
  const audioFilename = `questions/${interview.id}/round-1.mp3`
  await uploadAudio(audioFilename, audioBuffer, 'audio/mpeg')
  const audioUrl = await getAudioUrl(audioFilename)

  // 创建面试轮次
  const round = await prisma.interviewRound.create({
    data: {
      interviewId: interview.id,
      roundNumber: 1,
      dimension,
      questionText,
      questionAudioUrl: `/${process.env.MINIO_BUCKET || 'interview-audio'}/${audioFilename}`,
    },
  })

  await prisma.interview.update({
    where: { id: interview.id },
    data: { currentRound: 1 },
  })

  return NextResponse.json({
    data: {
      question: {
        roundNumber: round.roundNumber,
        questionText: round.questionText,
        questionAudioUrl: audioUrl,
        dimension: round.dimension,
      },
    },
  })
}
