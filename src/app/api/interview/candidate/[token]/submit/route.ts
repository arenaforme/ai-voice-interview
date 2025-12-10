import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { transcribeAudio } from '@/lib/ai/asr'
import { evaluateAnswer, generateQuestionSmart, generateReport, InterviewContext } from '@/lib/ai/llm'
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

  // 计算已覆盖的维度
  const template = interview.position.template
  const dimensions = template.dimensions as string[]
  const coveredDimensions = [...new Set(interview.rounds.map((r) => r.dimension))]

  // 构建对话历史
  const previousQA = interview.rounds.map((r) => ({
    question: r.questionText,
    answer: r.answerText || '',
    dimension: r.dimension,
  }))
  previousQA.push({
    question: currentRound.questionText,
    answer: answerText,
    dimension: currentRound.dimension,
  })

  // 更新已覆盖维度（包含当前轮次）
  if (!coveredDimensions.includes(currentRound.dimension)) {
    coveredDimensions.push(currentRound.dimension)
  }

  const questionTemplates = template.questionTemplates as Array<{
    dimension: string
    sampleQuestions: string[]
  }> | null

  // 构建面试上下文
  const context: InterviewContext = {
    positionName: interview.position.name,
    systemPrompt: template.systemPrompt,
    allDimensions: dimensions,
    coveredDimensions,
    currentRound: currentRound.roundNumber,
    minRounds: interview.minRounds,
    maxRounds: interview.maxRounds,
    previousQA,
    questionTemplates: questionTemplates || undefined,
  }

  // 判断是否应该结束面试
  const allDimensionsCovered = coveredDimensions.length >= dimensions.length
  const reachedMax = currentRound.roundNumber >= interview.maxRounds
  const reachedMinAndCovered = currentRound.roundNumber >= interview.minRounds && allDimensionsCovered

  const isComplete = reachedMax || reachedMinAndCovered

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
        qaRecords: JSON.parse(JSON.stringify(reportData.qaRecords)),
        dimensionScores: reportData.dimensionScores,
        strengths: reportData.strengths,
        risks: reportData.risks,
        recommendation: reportData.recommendation,
        summary: reportData.summary,
      },
    })

    await prisma.interview.update({
      where: { id: interview.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    })

    return NextResponse.json({
      data: {
        isComplete: true,
        progress: {
          current: currentRound.roundNumber,
          min: interview.minRounds,
          max: interview.maxRounds,
          coveredDimensions,
        },
      },
    })
  }

  // 智能生成下一个问题
  const result = await generateQuestionSmart(context)

  // 生成语音
  const nextAudioBuffer = await synthesizeSpeech(result.question)
  const nextAudioFilename = `questions/${interview.id}/round-${currentRound.roundNumber + 1}.mp3`
  await uploadAudio(nextAudioFilename, nextAudioBuffer, 'audio/mpeg')
  const nextAudioUrl = await getAudioUrl(nextAudioFilename)

  // 创建下一轮
  const nextRound = await prisma.interviewRound.create({
    data: {
      interviewId: interview.id,
      roundNumber: currentRound.roundNumber + 1,
      dimension: result.dimension,
      questionText: result.question,
      questionAudioUrl: `/${process.env.MINIO_BUCKET || 'interview-audio'}/${nextAudioFilename}`,
    },
  })

  await prisma.interview.update({
    where: { id: interview.id },
    data: { currentRound: nextRound.roundNumber },
  })

  // 更新覆盖维度
  const newCoveredDimensions = coveredDimensions.includes(result.dimension)
    ? coveredDimensions
    : [...coveredDimensions, result.dimension]

  return NextResponse.json({
    data: {
      isComplete: false,
      nextQuestion: {
        roundNumber: nextRound.roundNumber,
        questionText: nextRound.questionText,
        questionAudioUrl: nextAudioUrl,
        dimension: nextRound.dimension,
      },
      progress: {
        current: nextRound.roundNumber,
        min: interview.minRounds,
        max: interview.maxRounds,
        coveredDimensions: newCoveredDimensions,
      },
    },
  })
}
