import type {
  ClientEvent,
  ServerEvent,
  SessionConfig,
  EvaluationData,
  InterviewState,
} from './types'

// 使用本地代理服务器，而非直接连接 OpenAI
const getProxyUrl = () => {
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname
    // 开发环境（localhost 且端口为 3000）使用 3001 端口
    // 生产环境使用同一端口的 /api/realtime-proxy 路径
    const isDev = host === 'localhost' && window.location.port === '3000'
    const port = isDev ? '3001' : window.location.port
    return `${protocol}//${host}:${port}/api/realtime-proxy`
  }
  return 'ws://localhost:3001/api/realtime-proxy'
}

export interface RealtimeClientOptions {
  token: string // 面试 token，用于连接代理服务器
  onStateChange?: (state: InterviewState) => void
  onAudioData?: (audioData: ArrayBuffer) => void
  onEvaluation?: (data: EvaluationData) => void
  onInterviewEnd?: (reason: string) => void
  onError?: (error: Error) => void
  onTranscript?: (text: string, role: 'user' | 'assistant') => void
}

export class RealtimeClient {
  private ws: WebSocket | null = null
  private options: RealtimeClientOptions
  private state: InterviewState = 'connecting'
  private evaluations: EvaluationData[] = []

  constructor(options: RealtimeClientOptions) {
    this.options = options
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // 连接本地代理服务器，通过 URL 参数传递面试 token
      const proxyUrl = getProxyUrl()
      const url = `${proxyUrl}?token=${this.options.token}`
      console.log('[RealtimeClient] Connecting to proxy:', url)

      this.ws = new WebSocket(url)

      this.ws.onopen = () => {
        console.log('[RealtimeClient] WebSocket connected')
        // 等待代理服务器确认连接到 OpenAI
      }

      this.ws.onerror = (event) => {
        console.error('[RealtimeClient] WebSocket error:', event)
        const error = new Error('WebSocket connection failed')
        this.options.onError?.(error)
        reject(error)
      }

      this.ws.onclose = (event) => {
        console.log('[RealtimeClient] WebSocket closed:', event.code, event.reason)
        if (this.state !== 'ended') {
          this.setState('error')
        }
      }

      this.ws.onmessage = (event) => {
        const data = event.data as string
        // 处理代理服务器的连接确认消息
        if (data.includes('proxy.connected')) {
          console.log('[RealtimeClient] Proxy connected to OpenAI')
          this.setState('ready')
          resolve()
          return
        }
        this.handleMessage(data)
      }
    })
  }

  private setState(state: InterviewState) {
    this.state = state
    this.options.onStateChange?.(state)
  }

  private send(event: ClientEvent) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event))
    }
  }

  private handleMessage(data: string) {
    try {
      const event = JSON.parse(data) as ServerEvent

      switch (event.type) {
        case 'session.created':
        case 'session.updated':
          // 会话已创建/更新
          break

        case 'input_audio_buffer.speech_started':
          this.setState('listening')
          break

        case 'input_audio_buffer.speech_stopped':
          this.setState('thinking')
          break

        case 'response.created':
          this.setState('thinking')
          break

        case 'response.audio.delta':
          this.setState('speaking')
          // 解码 base64 音频数据
          const audioData = this.base64ToArrayBuffer(event.delta)
          this.options.onAudioData?.(audioData)
          break

        case 'response.audio.done':
          this.setState('ready')
          break

        case 'conversation.item.input_audio_transcription.completed':
          this.options.onTranscript?.(event.transcript, 'user')
          break

        case 'response.audio_transcript.done':
          this.options.onTranscript?.(event.transcript, 'assistant')
          break

        case 'response.function_call_arguments.done':
          this.handleFunctionCall(event.call_id, event.name, event.arguments)
          break

        case 'error':
          console.error('Realtime API error:', event.error)
          this.options.onError?.(new Error(event.error.message))
          break

        case 'rate_limits.updated':
          // 忽略速率限制更新
          break
      }
    } catch (error) {
      console.error('Failed to parse message:', error)
    }
  }

  private handleFunctionCall(callId: string, name: string, args: string) {
    console.log('[RealtimeClient] 收到函数调用:', name, args)
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
        this.evaluations.push(evaluation)
        console.log('[RealtimeClient] 记录评估数据，当前共:', this.evaluations.length, '条')
        this.options.onEvaluation?.(evaluation)

        // 发送函数调用结果
        this.send({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: callId,
            output: JSON.stringify({ success: true }),
          },
        })
        // 继续生成响应
        this.send({ type: 'response.create' })
      } else if (name === 'end_interview') {
        console.log('[RealtimeClient] 收到结束面试指令，当前评估数据:', this.evaluations.length, '条')
        this.setState('ended')
        this.options.onInterviewEnd?.(parsedArgs.reason || '面试结束')

        // 发送函数调用结果
        this.send({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: callId,
            output: JSON.stringify({ success: true }),
          },
        })
      }
    } catch (error) {
      console.error('Failed to handle function call:', error)
    }
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
  }

  // 配置会话
  configureSession(config: Partial<SessionConfig>) {
    this.send({ type: 'session.update', session: config })
  }

  // 发送音频数据
  sendAudio(audioData: ArrayBuffer) {
    const base64 = this.arrayBufferToBase64(audioData)
    this.send({ type: 'input_audio_buffer.append', audio: base64 })
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  // 开始面试（触发 AI 开场白）
  startInterview() {
    this.send({ type: 'response.create' })
  }

  // 获取评估结果
  getEvaluations(): EvaluationData[] {
    return [...this.evaluations]
  }

  // 获取当前状态
  getState(): InterviewState {
    return this.state
  }


  // 主动结束面试
  endInterview(reason: string = '用户主动结束') {
    this.setState('ended')
    this.options.onInterviewEnd?.(reason)
  }

  // 断开连接
  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }
}
