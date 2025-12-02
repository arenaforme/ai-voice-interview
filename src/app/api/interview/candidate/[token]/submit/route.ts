import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { transcribeAudio } from '@/lib/ai/asr'
import { evaluateAnswer, generateQuestion, generateReport } from '@/lib/ai/llm'
import { synthesizeSpeech } from '@/lib/ai/tts'
import { uploadAudio, getAudioUrl } from '@/lib/storage/minio'

interface RouteParams {
  params: Promise<{ token: string }>
}

// 提交回答
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

  if (interview.status !== 'IN_PROGRESS') {
    return NextResponse.json({ error: '面试状态异常' }, { status: 400 })
  }

  // 获取音频数据
  const formData = await request.formData()
  const audioFile = formData.get('audio') as File
  const durationSeconds = parseInt(formData.get('duration') as string) || 0

  if (!audioFile) {
    return NextResponse.json({ error: '缺少音频文件' }, { status: 400 })
  }

  const currentRound = interview.rounds[interview.rounds.length - 1]
  if (!currentRound || currentRound.answerText) {
    return NextResponse.json({ error: '当前轮次状态异常' }, { status: 400 })
  }

  // 上传音频
  const audioBuffer = Buffer.from(await audioFile.arrayBuffer())
  const answerFilename = `answers/${interview.id}/round-${currentRound.roundNumber}.webm`
  await uploadAudio(answerFilename, audioBuffer, 'audio/webm')

  // ASR 转写
  const answerText = await transcribeAudio(audioBuffer, 'audio.webm')

  // 评估回答
  const evaluation = await evaluateAnswer(
    interview.position.name,
    currentRound.questionText,
    answerText,
    currentRound.dimension
  )

  // 更新当前轮次
  await prisma.interviewRound.update({
    where: { id: currentRound.id },
    data: {
      answerText,
      answerAudioUrl: `/${process.env.MINIO_BUCKET || 'interview-audio'}/${answerFilename}`,
      score: evaluation.score,
      evaluation: evaluation.feedback,
      durationSeconds,
    },
  })

  // 检查是否完成所有轮次
  const isComplete = currentRound.roundNumber >= interview.maxRounds

  if (isComplete) {
    // 生成报告
    const allRounds = await prisma.interviewRound.findMany({
      where: { interviewId: interview.id },
      orderBy: { roundNumber: 'asc' },
    })

    const reportData = await generateReport(interview.position.name, allRounds)

    await prisma.interviewReport.create({
      data: {
        interviewId: interview.id,
        ...reportData,
      },
    })

    await prisma.interview.update({
      where: { id: interview.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    })

    return NextResponse.json({
      data: { isComplete: true },
    })
  }

  // 生成下一个问题
  const template = interview.position.template
  const dimensions = template.dimensions as string[]
  const nextDimension = dimensions[currentRound.roundNumber % dimensions.length] || '综合能力'

  const previousQA = interview.rounds.map((r) => ({
    question: r.questionText,
    answer: r.answerText || '',
  }))
  previousQA.push({ question: currentRound.questionText, answer: answerText })

  const nextQuestionText = await generateQuestion(
    interview.position.name,
    template.systemPrompt,
    nextDimension,
    previousQA
  )

  // 生成语音
  const nextAudioBuffer = await synthesizeSpeech(nextQuestionText)
  const nextAudioFilename = `questions/${interview.id}/round-${currentRound.roundNumber + 1}.mp3`
  await uploadAudio(nextAudioFilename, nextAudioBuffer, 'audio/mpeg')
  const nextAudioUrl = await getAudioUrl(nextAudioFilename)

  // 创建下一轮
  const nextRound = await prisma.interviewRound.create({
    data: {
      interviewId: interview.id,
      roundNumber: currentRound.roundNumber + 1,
      dimension: nextDimension,
      questionText: nextQuestionText,
      questionAudioUrl: `/${process.env.MINIO_BUCKET || 'interview-audio'}/${nextAudioFilename}`,
    },
  })

  await prisma.interview.update({
    where: { id: interview.id },
    data: { currentRound: nextRound.roundNumber },
  })

  return NextResponse.json({
    data: {
      isComplete: false,
      nextQuestion: {
        roundNumber: nextRound.roundNumber,
        questionText: nextRound.questionText,
        questionAudioUrl: nextAudioUrl,
        dimension: nextRound.dimension,
      },
    },
  })
}
