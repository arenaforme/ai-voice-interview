import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { generateQuestionSmart, InterviewContext } from '@/lib/ai/llm'
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
      rounds: { orderBy: { roundNumber: 'asc' } },
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
          progress: {
            current: interview.currentRound,
            min: interview.minRounds,
            max: interview.maxRounds,
          },
        },
      })
    }
  }

  const template = interview.position.template
  const dimensions = template.dimensions as string[]
  const questionTemplates = template.questionTemplates as Array<{
    dimension: string
    sampleQuestions: string[]
  }> | null

  // 更新面试状态和问题数配置
  if (interview.status === 'PENDING') {
    await prisma.interview.update({
      where: { id: interview.id },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
        minRounds: template.minQuestions,
        maxRounds: template.maxQuestions,
      },
    })
  }

  // 构建面试上下文
  const context: InterviewContext = {
    positionName: interview.position.name,
    systemPrompt: template.systemPrompt,
    allDimensions: dimensions,
    coveredDimensions: [],
    currentRound: 0,
    minRounds: template.minQuestions,
    maxRounds: template.maxQuestions,
    previousQA: [],
    questionTemplates: questionTemplates || undefined,
  }

  // 智能生成第一个问题
  const result = await generateQuestionSmart(context)

  // 生成语音
  const audioBuffer = await synthesizeSpeech(result.question)
  const audioFilename = `questions/${interview.id}/round-1.mp3`
  await uploadAudio(audioFilename, audioBuffer, 'audio/mpeg')
  const audioUrl = await getAudioUrl(audioFilename)

  // 创建面试轮次
  const round = await prisma.interviewRound.create({
    data: {
      interviewId: interview.id,
      roundNumber: 1,
      dimension: result.dimension,
      questionText: result.question,
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
      progress: {
        current: 1,
        min: template.minQuestions,
        max: template.maxQuestions,
      },
    },
  })
}
