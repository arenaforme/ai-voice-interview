/**
 * OpenAI Realtime API 代理服务器
 * 浏览器 <-> 本地代理 <-> OpenAI Realtime API
 * 在服务端拦截函数调用，直接保存数据到数据库
 */
import { Server as HttpServer } from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import { prisma } from '@/lib/db/prisma'
import { generateReport } from '@/lib/ai/llm'

const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime'
const MODEL = 'gpt-4o-realtime-preview-2024-12-17'

interface EvaluationData {
  dimension: string
  question: string
  answer: string
  score: number
  analysis: string
}

interface ProxySession {
  token: string
  interviewId: string
  browserSocket: WebSocket
  openaiSocket: WebSocket | null
  evaluations: EvaluationData[]
  positionName: string
  templateDimensions: string[]
}

const proxySessions = new Map<string, ProxySession>()

export function setupRealtimeProxy(server: HttpServer) {
  const wss = new WebSocketServer({
    server,
    path: '/api/realtime-proxy',
  })

  console.log('[RealtimeProxy] Server initialized on /api/realtime-proxy')

  wss.on('connection', async (browserWs, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`)
    const token = url.searchParams.get('token')

    if (!token) {
      browserWs.close(4001, 'Missing interview token')
      return
    }

    console.log(`[RealtimeProxy] Browser connected: ${token.substring(0, 8)}...`)

    try {
      // 验证面试 token
      const interview = await prisma.interview.findUnique({
        where: { token },
        include: {
          position: { include: { template: true } },
        },
      })

      if (!interview) {
        browserWs.close(4004, 'Interview not found')
        return
      }

      if (interview.status === 'COMPLETED') {
        browserWs.close(4003, 'Interview already completed')
        return
      }

      // 提取模板维度
      const templateDimensions = (
        interview.position.template.dimensions as Array<{ name: string } | string>
      ).map((d) => (typeof d === 'string' ? d : d.name))

      // 创建代理会话
      const session: ProxySession = {
        token,
        interviewId: interview.id,
        browserSocket: browserWs,
        openaiSocket: null,
        evaluations: [],
        positionName: interview.position.name,
        templateDimensions,
      }

      proxySessions.set(token, session)

      // 连接到 OpenAI Realtime API
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        browserWs.close(4500, 'OpenAI API key not configured')
        return
      }

      const openaiUrl = `${OPENAI_REALTIME_URL}?model=${MODEL}`
      const openaiWs = new WebSocket(openaiUrl, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'OpenAI-Beta': 'realtime=v1',
        },
      })

      session.openaiSocket = openaiWs

      // OpenAI 连接成功
      openaiWs.on('open', () => {
        console.log(`[RealtimeProxy] OpenAI connected for ${token.substring(0, 8)}...`)
        // 通知浏览器连接成功
        browserWs.send(JSON.stringify({ type: 'proxy.connected' }))
      })

      // 处理 OpenAI 消息
      openaiWs.on('message', (data) => {
        handleOpenAIMessage(session, data.toString())
      })

      openaiWs.on('error', (error) => {
        console.error(`[RealtimeProxy] OpenAI error for ${token.substring(0, 8)}...`, error)
        browserWs.send(JSON.stringify({ type: 'error', error: { message: 'OpenAI connection error' } }))
      })

      openaiWs.on('close', () => {
        console.log(`[RealtimeProxy] OpenAI disconnected for ${token.substring(0, 8)}...`)
      })

      // 处理浏览器消息 - 转发到 OpenAI
      browserWs.on('message', (data) => {
        if (openaiWs.readyState === WebSocket.OPEN) {
          openaiWs.send(data.toString())
        }
      })

      browserWs.on('close', () => {
        console.log(`[RealtimeProxy] Browser disconnected: ${token.substring(0, 8)}...`)
        openaiWs.close()
        proxySessions.delete(token)
      })

      browserWs.on('error', (error) => {
        console.error(`[RealtimeProxy] Browser error for ${token.substring(0, 8)}...`, error)
      })

    } catch (error) {
      console.error('[RealtimeProxy] Connection error:', error)
      browserWs.close(4500, 'Internal server error')
    }
  })
}

// 处理 OpenAI 消息，拦截函数调用
function handleOpenAIMessage(session: ProxySession, data: string) {
  try {
    const event = JSON.parse(data)

    // 拦截函数调用完成事件
    if (event.type === 'response.function_call_arguments.done') {
      handleFunctionCall(session, event.call_id, event.name, event.arguments)
    }

    // 转发所有消息到浏览器
    if (session.browserSocket.readyState === WebSocket.OPEN) {
      session.browserSocket.send(data)
    }
  } catch (error) {
    console.error('[RealtimeProxy] Parse error:', error)
  }
}

// 处理函数调用 - 在服务端保存数据
async function handleFunctionCall(
  session: ProxySession,
  callId: string,
  name: string,
  args: string
) {
  const { token, interviewId, positionName, templateDimensions } = session
  console.log(`[RealtimeProxy] Function call: ${name} for ${token.substring(0, 8)}...`)

  try {
    const parsedArgs = JSON.parse(args)

    if (name === 'record_evaluation') {
      const evaluation: EvaluationData = {
        dimension: parsedArgs.dimension,
        question: parsedArgs.question || '',
        answer: parsedArgs.answer || '',
        score: parsedArgs.score,
        analysis: parsedArgs.analysis || parsedArgs.summary || '',
      }
      session.evaluations.push(evaluation)
      console.log(
        `[RealtimeProxy] Recorded evaluation #${session.evaluations.length}: ${evaluation.dimension} - ${evaluation.score}分`
      )
    } else if (name === 'end_interview') {
      console.log(
        `[RealtimeProxy] End interview with ${session.evaluations.length} evaluations`
      )
      // 在服务端直接保存面试结果
      await saveInterviewResult(session)
    }
  } catch (error) {
    console.error('[RealtimeProxy] Function call error:', error)
  }
}

// 保存面试结果到数据库
async function saveInterviewResult(session: ProxySession) {
  const { token, interviewId, evaluations, positionName, templateDimensions } = session

  if (evaluations.length === 0) {
    console.log(`[RealtimeProxy] No evaluations to save for ${token.substring(0, 8)}...`)
    return
  }

  try {
    // 检查面试是否已完成（幂等处理）
    const interview = await prisma.interview.findUnique({
      where: { id: interviewId },
    })

    if (interview?.status === 'COMPLETED') {
      console.log(`[RealtimeProxy] Interview already completed for ${token.substring(0, 8)}...`)
      return
    }

    // 转换为 generateReport 需要的格式
    const rounds = evaluations.map((e) => ({
      dimension: e.dimension,
      questionText: e.question || `关于${e.dimension}的问题`,
      answerText: e.answer || '',
      score: e.score,
      evaluation: e.analysis || '',
    }))

    console.log(`[RealtimeProxy] Generating report for ${token.substring(0, 8)}...`)
    const reportData = await generateReport(positionName, rounds, templateDimensions)

    // 更新面试记录并创建报告
    await prisma.interview.update({
      where: { id: interviewId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        report: {
          create: {
            qaRecords: JSON.parse(JSON.stringify(reportData.qaRecords)),
            dimensionScores: reportData.dimensionScores,
            strengths: reportData.strengths,
            risks: reportData.risks,
            recommendation: reportData.recommendation,
            summary: reportData.summary,
          },
        },
      },
    })

    console.log(`[RealtimeProxy] Interview saved successfully for ${token.substring(0, 8)}...`)
  } catch (error) {
    console.error(`[RealtimeProxy] Save error for ${token.substring(0, 8)}...`, error)
  }
}
