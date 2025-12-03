/**
 * WebSocket 服务器 - 实时语音面试
 * 简化架构：收集音频 → Whisper 转写 → Claude 生成问题 → TTS 返回
 */
import { Server as HttpServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { prisma } from '@/lib/db/prisma'
import { generateQuestionSmart, InterviewContext, evaluateAnswer, generateReport } from '@/lib/ai/llm'
import { synthesizeSpeech } from '@/lib/ai/tts'
import OpenAI from 'openai'

const openai = new OpenAI()

interface InterviewSession {
  token: string
  browserSocket: WebSocket
  interviewId: string
  positionName: string
  systemPrompt: string
  allDimensions: string[]
  coveredDimensions: string[]
  currentRound: number
  minRounds: number
  maxRounds: number
  previousQA: Array<{ question: string; answer: string; dimension: string }>
  questionTemplates: Array<{ dimension: string; sampleQuestions: string[] }>
  currentQuestion: string
  currentDimension: string
  // 音频缓冲区
  audioChunks: Buffer[]
  isRecording: boolean
}

const sessions = new Map<string, InterviewSession>()

export function setupWebSocketServer(server: HttpServer) {
  const wss = new WebSocketServer({
    server,
    path: '/api/realtime'
  })

  console.log('[WebSocket] Server initialized on /api/realtime')

  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`)
    const token = url.searchParams.get('token')

    if (!token) {
      ws.close(4001, 'Missing interview token')
      return
    }

    console.log(`[WebSocket] New connection for token: ${token.substring(0, 8)}...`)

    try {
      // 验证面试 token 并获取面试信息
      const interview = await prisma.interview.findUnique({
        where: { token },
        include: {
          position: {
            include: { template: true }
          },
          rounds: true
        }
      })

      if (!interview) {
        ws.close(4004, 'Interview not found')
        return
      }

      if (interview.status === 'COMPLETED') {
        ws.close(4003, 'Interview already completed')
        return
      }

      // 创建会话
      const session: InterviewSession = {
        token,
        browserSocket: ws,
        interviewId: interview.id,
        positionName: interview.position.name,
        systemPrompt: interview.position.template.systemPrompt || '',
        allDimensions: (interview.position.template.dimensions as string[]) || [],
        coveredDimensions: [],
        currentRound: interview.rounds.length,
        minRounds: interview.minRounds,
        maxRounds: interview.maxRounds,
        previousQA: interview.rounds.map(r => ({
          question: r.questionText,
          answer: r.answerText || '',
          dimension: r.dimension
        })),
        questionTemplates: (interview.position.template.questionTemplates as Array<{
          dimension: string
          sampleQuestions: string[]
        }>) || [],
        currentQuestion: '',
        currentDimension: '',
        audioChunks: [],
        isRecording: false
      }

      sessions.set(token, session)

      // 监听浏览器消息
      ws.on('message', (data) => handleBrowserMessage(session, data as Buffer))

      ws.on('close', () => {
        console.log(`[WebSocket] Browser disconnected: ${token.substring(0, 8)}...`)
        sessions.delete(token)
      })

      ws.on('error', (error) => {
        console.error(`[WebSocket] Error for ${token.substring(0, 8)}...`, error)
      })

      // 发送连接成功消息
      ws.send(JSON.stringify({
        type: 'connected',
        data: {
          interviewId: interview.id,
          candidateName: interview.candidateName,
          positionName: interview.position.name,
          currentRound: session.currentRound,
          minRounds: session.minRounds,
          maxRounds: session.maxRounds
        }
      }))

    } catch (error) {
      console.error('[WebSocket] Connection error:', error)
      ws.close(4500, 'Internal server error')
    }
  })
}

function handleBrowserMessage(session: InterviewSession, data: Buffer) {
  try {
    const message = JSON.parse(data.toString())

    switch (message.type) {
      case 'audio':
        // 收集音频数据
        if (session.isRecording && message.data) {
          const audioData = Buffer.from(message.data, 'base64')
          session.audioChunks.push(audioData)
        }
        break

      case 'start_recording':
        console.log(`[Browser] Start recording for ${session.token.substring(0, 8)}...`)
        session.audioChunks = []
        session.isRecording = true
        break

      case 'stop_recording':
        console.log(`[Browser] Stop recording for ${session.token.substring(0, 8)}...`)
        session.isRecording = false
        // 处理录音
        processRecording(session)
        break

      case 'start_interview':
        // 开始面试，生成第一个问题
        generateAndSendQuestion(session)
        break

      default:
        console.log(`[Browser] Unknown message type: ${message.type}`)
    }
  } catch (error) {
    console.error('[Browser] Message parse error:', error)
  }
}

async function processRecording(session: InterviewSession) {
  const { browserSocket, token } = session

  try {
    // 发送处理中状态
    browserSocket.send(JSON.stringify({
      type: 'processing',
      data: { message: '正在转写语音...' }
    }))

    // 合并音频数据
    const audioBuffer = Buffer.concat(session.audioChunks)
    console.log(`[Process] Audio buffer size: ${audioBuffer.length} bytes for ${token.substring(0, 8)}...`)

    if (audioBuffer.length < 1000) {
      console.log(`[Process] Audio too short, skipping for ${token.substring(0, 8)}...`)
      browserSocket.send(JSON.stringify({
        type: 'error',
        data: { message: '录音时间太短，请重新回答' }
      }))
      // 恢复到可录音状态
      browserSocket.send(JSON.stringify({
        type: 'ready',
        data: {}
      }))
      return
    }

    // 转换 PCM16 到 WAV 格式
    const wavBuffer = pcmToWav(audioBuffer, 24000, 1, 16)

    // 使用 Whisper API 转写
    console.log(`[Process] Transcribing audio for ${token.substring(0, 8)}...`)
    const transcription = await openai.audio.transcriptions.create({
      file: new File([wavBuffer], 'audio.wav', { type: 'audio/wav' }),
      model: 'whisper-1',
      language: 'zh'
    })

    const transcript = transcription.text.trim()
    console.log(`[Process] Transcript: "${transcript.substring(0, 50)}..." for ${token.substring(0, 8)}...`)

    if (!transcript) {
      browserSocket.send(JSON.stringify({
        type: 'error',
        data: { message: '未能识别语音，请重新回答' }
      }))
      browserSocket.send(JSON.stringify({
        type: 'ready',
        data: {}
      }))
      return
    }

    // 发送转写结果
    browserSocket.send(JSON.stringify({
      type: 'transcript',
      data: {
        text: transcript,
        isFinal: true
      }
    }))

    // 处理回答
    await processAnswer(session, transcript)

  } catch (error) {
    console.error(`[Process] Error for ${token.substring(0, 8)}...`, error)
    browserSocket.send(JSON.stringify({
      type: 'error',
      data: { message: '处理录音时出错，请重试' }
    }))
    browserSocket.send(JSON.stringify({
      type: 'ready',
      data: {}
    }))
  }
}

// PCM16 转 WAV 格式
function pcmToWav(pcmData: Buffer, sampleRate: number, channels: number, bitsPerSample: number): Buffer {
  const byteRate = sampleRate * channels * (bitsPerSample / 8)
  const blockAlign = channels * (bitsPerSample / 8)
  const dataSize = pcmData.length
  const headerSize = 44
  const fileSize = headerSize + dataSize - 8

  const header = Buffer.alloc(headerSize)

  // RIFF header
  header.write('RIFF', 0)
  header.writeUInt32LE(fileSize, 4)
  header.write('WAVE', 8)

  // fmt chunk
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16) // chunk size
  header.writeUInt16LE(1, 20) // audio format (PCM)
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitsPerSample, 34)

  // data chunk
  header.write('data', 36)
  header.writeUInt32LE(dataSize, 40)

  return Buffer.concat([header, pcmData])
}

async function processAnswer(session: InterviewSession, answer: string) {
  const { browserSocket, token } = session

  try {
    // 发送处理中状态
    browserSocket.send(JSON.stringify({
      type: 'processing',
      data: { message: '正在分析回答...' }
    }))

    // 评估回答
    console.log(`[Process] Evaluating answer for ${token.substring(0, 8)}...`)
    const evaluation = await evaluateAnswer(
      session.positionName,
      session.currentQuestion,
      answer,
      session.currentDimension
    )
    console.log(`[Process] Score: ${evaluation.score} for ${token.substring(0, 8)}...`)

    // 保存回答到数据库（包含评分）
    await prisma.interviewRound.create({
      data: {
        interviewId: session.interviewId,
        roundNumber: session.currentRound + 1,
        questionText: session.currentQuestion,
        answerText: answer,
        dimension: session.currentDimension,
        score: evaluation.score,
        evaluation: evaluation.feedback
      }
    })

    // 更新会话状态
    session.previousQA.push({
      question: session.currentQuestion,
      answer: answer,
      dimension: session.currentDimension
    })

    if (!session.coveredDimensions.includes(session.currentDimension)) {
      session.coveredDimensions.push(session.currentDimension)
    }

    session.currentRound++

    // 检查是否应该结束面试
    const reachedMax = session.currentRound >= session.maxRounds
    const reachedMinAndCovered =
      session.currentRound >= session.minRounds &&
      session.coveredDimensions.length >= session.allDimensions.length

    if (reachedMax || reachedMinAndCovered) {
      // 结束面试
      await endInterview(session)
    } else {
      // 生成下一个问题
      await generateAndSendQuestion(session)
    }

  } catch (error) {
    console.error(`[Process] Error processing answer for ${token.substring(0, 8)}...`, error)
    browserSocket.send(JSON.stringify({
      type: 'error',
      data: { message: '处理回答时出错' }
    }))
  }
}

async function generateAndSendQuestion(session: InterviewSession) {
  const { browserSocket } = session

  try {
    browserSocket.send(JSON.stringify({
      type: 'generating',
      data: { message: '正在生成问题...' }
    }))

    // 使用 Claude 生成问题
    const context: InterviewContext = {
      positionName: session.positionName,
      systemPrompt: session.systemPrompt,
      allDimensions: session.allDimensions,
      coveredDimensions: session.coveredDimensions,
      currentRound: session.currentRound,
      minRounds: session.minRounds,
      maxRounds: session.maxRounds,
      previousQA: session.previousQA,
      questionTemplates: session.questionTemplates
    }

    console.log(`[Generate] Generating question for ${session.token.substring(0, 8)}...`)
    const result = await generateQuestionSmart(context)

    session.currentQuestion = result.question
    session.currentDimension = result.dimension

    // 生成语音
    console.log(`[Generate] Synthesizing speech for ${session.token.substring(0, 8)}...`)
    const audioBuffer = await synthesizeSpeech(result.question)
    const audioBase64 = audioBuffer.toString('base64')

    // 发送问题和语音到浏览器
    browserSocket.send(JSON.stringify({
      type: 'question',
      data: {
        question: result.question,
        dimension: result.dimension,
        audio: audioBase64,
        currentRound: session.currentRound + 1,
        minRounds: session.minRounds,
        maxRounds: session.maxRounds,
        shouldEnd: result.shouldEnd
      }
    }))

    console.log(`[Generate] Question sent for ${session.token.substring(0, 8)}...`)

  } catch (error) {
    console.error('[Generate] Error generating question:', error)
    browserSocket.send(JSON.stringify({
      type: 'error',
      data: { message: '生成问题时出错' }
    }))
  }
}

async function endInterview(session: InterviewSession) {
  const { browserSocket, interviewId, token } = session

  try {
    // 先通知候选人面试已完成
    browserSocket.send(JSON.stringify({
      type: 'completed',
      data: {
        message: '面试已完成',
        totalRounds: session.currentRound
      }
    }))

    // 获取所有面试轮次数据用于生成报告
    console.log(`[End] Fetching rounds for report generation ${token.substring(0, 8)}...`)
    const rounds = await prisma.interviewRound.findMany({
      where: { interviewId },
      orderBy: { roundNumber: 'asc' }
    })

    // 生成面试报告
    console.log(`[End] Generating report for ${token.substring(0, 8)}...`)
    const reportData = await generateReport(
      session.positionName,
      rounds.map(r => ({
        dimension: r.dimension,
        questionText: r.questionText,
        answerText: r.answerText,
        score: r.score,
        evaluation: r.evaluation
      }))
    )
    console.log(`[End] Report generated, recommendation: ${reportData.recommendation}`)

    // 保存报告到数据库
    await prisma.interviewReport.create({
      data: {
        interviewId,
        dimensionScores: reportData.dimensionScores,
        strengths: reportData.strengths,
        risks: reportData.risks,
        recommendation: reportData.recommendation,
        summary: reportData.summary
      }
    })

    // 更新面试状态
    await prisma.interview.update({
      where: { id: interviewId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date()
      }
    })

    console.log(`[End] Interview completed for ${token.substring(0, 8)}...`)

  } catch (error) {
    console.error('[End] Error ending interview:', error)
  }
}
