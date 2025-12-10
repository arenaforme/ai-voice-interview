/**
 * 独立 WebSocket 服务器
 * 用于 OpenAI Realtime API 中继
 * 运行在端口 3001，与 Next.js 开发服务器分离
 */
import { createServer, IncomingMessage } from 'http'
import { WebSocketServer } from 'ws'
import { Duplex } from 'stream'
import { prisma } from './src/lib/db/prisma'
import { generateReport } from './src/lib/ai/llm'

const port = parseInt(process.env.WS_PORT || '3001', 10)

// OpenAI Realtime API 配置
const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime'
const MODEL = 'gpt-4o-realtime-preview-2024-12-17'

// 创建 HTTP 服务器
const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', service: 'websocket-server' }))
    return
  }
  res.writeHead(404)
  res.end('Not Found')
})

// 创建 WebSocket 服务器（noServer 模式）
const wssProxy = new WebSocketServer({ noServer: true })

console.log('[RealtimeProxy] WebSocket server initialized')

// 处理 WebSocket 升级请求
server.on('upgrade', (request: IncomingMessage, socket: Duplex, head: Buffer) => {
  const pathname = new URL(request.url || '', `http://${request.headers.host}`).pathname

  console.log(`[Server] Upgrade request for path: ${pathname}`)

  if (pathname === '/api/realtime-proxy') {
    wssProxy.handleUpgrade(request, socket, head, (ws) => {
      wssProxy.emit('connection', ws, request)
    })
  } else {
    console.log(`[Server] Unknown path: ${pathname}, closing socket`)
    socket.destroy()
  }
})

// 代理会话接口
interface ProxySession {
  token: string
  interviewId: string
  positionName: string
  templateDimensions: string[]
  evaluations: Array<{
    dimension: string
    question: string
    answer: string
    score: number
    analysis: string
  }>
}

const proxySessions = new Map<string, ProxySession>()

// 处理代理连接
wssProxy.on('connection', async (browserWs, req) => {
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
      positionName: interview.position.name,
      templateDimensions,
      evaluations: [],
    }

    proxySessions.set(token, session)

    // 连接到 OpenAI Realtime API
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      browserWs.close(4500, 'OpenAI API key not configured')
      return
    }

    const { default: WebSocket } = await import('ws')
    const openaiUrl = `${OPENAI_REALTIME_URL}?model=${MODEL}`
    const openaiWs = new WebSocket(openaiUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'OpenAI-Beta': 'realtime=v1',
      },
    })

    // OpenAI 连接成功
    openaiWs.on('open', () => {
      console.log(`[RealtimeProxy] OpenAI connected for ${token.substring(0, 8)}...`)
      browserWs.send(JSON.stringify({ type: 'proxy.connected' }))
    })

    // 处理 OpenAI 消息
    openaiWs.on('message', (data) => {
      const message = data.toString()
      try {
        const event = JSON.parse(message)
        // 拦截函数调用
        if (event.type === 'response.function_call_arguments.done') {
          handleFunctionCall(session, event.name, event.arguments)
        }
      } catch {}
      // 转发到浏览器
      if (browserWs.readyState === 1) {
        browserWs.send(message)
      }
    })

    openaiWs.on('error', (error) => {
      console.error(`[RealtimeProxy] OpenAI error:`, error)
      browserWs.send(JSON.stringify({ type: 'error', error: { message: 'OpenAI error' } }))
    })

    openaiWs.on('close', () => {
      console.log(`[RealtimeProxy] OpenAI disconnected for ${token.substring(0, 8)}...`)
    })

    // 浏览器消息转发到 OpenAI
    browserWs.on('message', (data) => {
      if (openaiWs.readyState === 1) {
        openaiWs.send(data.toString())
      }
    })

    browserWs.on('close', () => {
      console.log(`[RealtimeProxy] Browser disconnected: ${token.substring(0, 8)}...`)
      openaiWs.close()
      proxySessions.delete(token)
    })

  } catch (error) {
    console.error('[RealtimeProxy] Connection error:', error)
    browserWs.close(4500, 'Internal server error')
  }
})

// 处理函数调用
async function handleFunctionCall(session: ProxySession, name: string, args: string) {
  console.log(`[RealtimeProxy] Function call: ${name}`)
  try {
    const parsedArgs = JSON.parse(args)
    if (name === 'record_evaluation') {
      session.evaluations.push({
        dimension: parsedArgs.dimension,
        question: parsedArgs.question || '',
        answer: parsedArgs.answer || '',
        score: parsedArgs.score,
        analysis: parsedArgs.analysis || parsedArgs.summary || '',
      })
      console.log(`[RealtimeProxy] Recorded evaluation #${session.evaluations.length}`)
    } else if (name === 'end_interview') {
      console.log(`[RealtimeProxy] End interview with ${session.evaluations.length} evaluations`)
      await saveInterviewResult(session)
    }
  } catch (error) {
    console.error('[RealtimeProxy] Function call error:', error)
  }
}

// 保存面试结果
async function saveInterviewResult(session: ProxySession) {
  const { token, interviewId, evaluations, positionName, templateDimensions } = session

  if (evaluations.length === 0) {
    console.log(`[RealtimeProxy] No evaluations to save`)
    return
  }

  try {
    const interview = await prisma.interview.findUnique({ where: { id: interviewId } })
    if (interview?.status === 'COMPLETED') {
      console.log(`[RealtimeProxy] Interview already completed`)
      return
    }

    const rounds = evaluations.map((e) => ({
      dimension: e.dimension,
      questionText: e.question || `关于${e.dimension}的问题`,
      answerText: e.answer || '',
      score: e.score,
      evaluation: e.analysis || '',
    }))

    console.log(`[RealtimeProxy] Generating report...`)
    const reportData = await generateReport(positionName, rounds, templateDimensions)

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

    console.log(`[RealtimeProxy] Interview saved successfully`)
  } catch (error) {
    console.error(`[RealtimeProxy] Save error:`, error)
  }
}

// 启动服务器
server.listen(port, '0.0.0.0', () => {
  console.log(`> WebSocket server ready on http://localhost:${port}`)
  console.log(`> Realtime proxy endpoint: ws://localhost:${port}/api/realtime-proxy`)
})
