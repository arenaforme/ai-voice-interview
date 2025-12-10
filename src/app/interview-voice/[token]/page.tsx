'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Mic, MicOff, Phone, PhoneOff, Loader2 } from 'lucide-react'
import {
  RealtimeClient,
  AudioRecorder,
  AudioPlayer,
  type InterviewState,
  type EvaluationData,
} from '@/lib/realtime-client'

interface SessionConfig {
  interviewId: string
  candidateName: string
  positionName: string
  minRounds: number
  maxRounds: number
  dimensions: string[]
  systemPrompt: string
  voice: string
}

const stateMessages: Record<InterviewState, string> = {
  connecting: '正在连接...',
  ready: '准备就绪，请开始说话',
  listening: '正在聆听...',
  thinking: 'AI 正在思考...',
  speaking: 'AI 正在说话...',
  ended: '面试已结束',
  error: '连接出错',
}

export default function InterviewVoicePage() {
  const params = useParams()
  const token = params.token as string

  const [state, setState] = useState<InterviewState>('connecting')
  const [sessionConfig, setSessionConfig] = useState<SessionConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [micEnabled, setMicEnabled] = useState(false)
  const [evaluations, setEvaluations] = useState<EvaluationData[]>([])

  const clientRef = useRef<RealtimeClient | null>(null)
  const recorderRef = useRef<AudioRecorder | null>(null)
  const playerRef = useRef<AudioPlayer | null>(null)
  const isEndingRef = useRef(false) // 防止重复调用结束逻辑
  const handleInterviewEndRef = useRef<() => Promise<void>>(null!) // 存储最新的结束处理函数

  // 初始化面试
  const initInterview = useCallback(async () => {
    try {
      // 1. 获取面试配置
      const configRes = await fetch(`/api/realtime/session/${token}`)
      if (!configRes.ok) {
        const data = await configRes.json()
        throw new Error(data.error || '获取面试配置失败')
      }
      const config: SessionConfig = await configRes.json()
      setSessionConfig(config)

      // 2. 初始化音频播放器
      playerRef.current = new AudioPlayer()
      await playerRef.current.init()

      // 3. 创建 Realtime 客户端（使用面试 token 连接本地代理服务器）
      // 代理服务器会在服务端处理 API Key 和数据持久化
      clientRef.current = new RealtimeClient({
        token: token, // 使用面试 token，而非 OpenAI ephemeral token
        onStateChange: setState,
        onAudioData: (data) => playerRef.current?.play(data),
        onEvaluation: (data) => setEvaluations((prev) => [...prev, data]),
        onInterviewEnd: () => handleInterviewEndRef.current?.(),
        onError: (err) => setError(err.message),
      })

      // 4. 连接 WebSocket（通过本地代理服务器）
      await clientRef.current.connect()

      // 5. 配置会话
      clientRef.current.configureSession({
        modalities: ['text', 'audio'],
        voice: config.voice || 'alloy',
        instructions: config.systemPrompt,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: { model: 'whisper-1' },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
          create_response: true,
        },
        tools: [
          {
            type: 'function',
            name: 'record_evaluation',
            description: `记录当前问题的评估结果，包含完整的问答内容和分析。每个维度必须至少调用一次。必须覆盖的维度：${config.dimensions.join('、')}`,
            parameters: {
              type: 'object',
              properties: {
                dimension: {
                  type: 'string',
                  description: `评估维度，必须是以下之一：${config.dimensions.join('、')}`,
                  enum: config.dimensions,
                },
                question: {
                  type: 'string',
                  description: '你刚才提出的面试问题（中文，完整记录）',
                },
                answer: {
                  type: 'string',
                  description: '候选人的回答内容（中文，完整记录候选人说的话）',
                },
                score: { type: 'number', description: '评分 0-5' },
                analysis: {
                  type: 'string',
                  description: '针对该回答的专业分析评价（中文，包含优点和不足）',
                },
              },
              required: ['dimension', 'question', 'answer', 'score', 'analysis'],
            },
          },
          {
            type: 'function',
            name: 'end_interview',
            description: `结束面试。【重要】只有当所有 ${config.dimensions.length} 个维度（${config.dimensions.join('、')}）都已通过 record_evaluation 记录评分后，才能调用此函数`,
            parameters: {
              type: 'object',
              properties: {
                reason: { type: 'string', description: '结束原因' },
              },
            },
          },
        ],
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '初始化失败')
      setState('error')
    }
  }, [token])

  // 禁用麦克风
  const disableMic = useCallback(() => {
    recorderRef.current?.stop()
    recorderRef.current = null
    setMicEnabled(false)
  }, [])

  // 启用麦克风
  const enableMic = useCallback(async () => {
    try {
      recorderRef.current = new AudioRecorder()
      await recorderRef.current.start((audioData: ArrayBuffer) => {
        clientRef.current?.sendAudio(audioData)
      })
      setMicEnabled(true)
    } catch (err) {
      setError('无法访问麦克风，请检查权限设置')
    }
  }, [])

  // 面试结束处理
  // 注意：数据保存已在服务端代理完成，前端只需更新 UI 状态
  const handleInterviewEnd = useCallback(async () => {
    console.log('[handleInterviewEnd] 面试结束，更新 UI 状态')

    // 使用 ref 防止重复调用
    if (isEndingRef.current) {
      console.log('[handleInterviewEnd] 已在进行中，跳过重复调用')
      return
    }
    isEndingRef.current = true

    setState('ended')
    disableMic()

    // 数据已在服务端代理保存，无需前端调用 API
    console.log('[handleInterviewEnd] 面试数据已由服务端代理保存')
  }, [disableMic])

  // 保持 ref 始终指向最新的 handleInterviewEnd
  handleInterviewEndRef.current = handleInterviewEnd

  // 主动结束面试
  const endInterview = useCallback(() => {
    clientRef.current?.endInterview()
  }, [])

  // 初始化
  useEffect(() => {
    initInterview()
    return () => {
      disableMic()
      playerRef.current?.stop()
      clientRef.current?.disconnect()
    }
  }, [initInterview, disableMic])

  // 状态指示器样式
  const getStateIndicator = () => {
    const baseClass = 'w-4 h-4 rounded-full'
    switch (state) {
      case 'connecting':
        return <div className={`${baseClass} bg-yellow-500 animate-pulse`} />
      case 'ready':
        return <div className={`${baseClass} bg-green-500`} />
      case 'listening':
        return <div className={`${baseClass} bg-blue-500 animate-pulse`} />
      case 'thinking':
        return <div className={`${baseClass} bg-purple-500 animate-pulse`} />
      case 'speaking':
        return <div className={`${baseClass} bg-green-500 animate-pulse`} />
      case 'ended':
        return <div className={`${baseClass} bg-gray-500`} />
      case 'error':
        return <div className={`${baseClass} bg-red-500`} />
      default:
        return <div className={`${baseClass} bg-gray-300`} />
    }
  }

  // 错误页面
  if (error && state === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold mb-2">连接失败</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={() => window.location.reload()}>重试</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 面试结束页面
  if (state === 'ended') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="text-green-500 text-6xl mb-4">✓</div>
            <h2 className="text-xl font-semibold mb-2">面试已完成</h2>
            <p className="text-gray-600">感谢您参加本次面试，结果将由 HR 审核后通知您。</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // 主面试界面
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col">
      {/* 顶部信息栏 */}
      <header className="bg-white shadow-sm p-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">
              {sessionConfig?.positionName || '加载中...'}
            </h1>
            <p className="text-sm text-gray-500">AI 语音面试</p>
          </div>
          <div className="flex items-center gap-2">
            {getStateIndicator()}
            <span className="text-sm text-gray-600">{stateMessages[state]}</span>
          </div>
        </div>
      </header>

      {/* 主内容区 - 状态可视化 */}
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          {/* 动态波形/状态指示 */}
          <div className="relative w-48 h-48 mx-auto mb-8">
            {state === 'connecting' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />
              </div>
            )}
            {state === 'listening' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 bg-blue-500/20 rounded-full animate-ping" />
                <Mic className="absolute w-16 h-16 text-blue-500" />
              </div>
            )}
            {state === 'thinking' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 bg-purple-500/20 rounded-full animate-pulse" />
                <Loader2 className="absolute w-16 h-16 text-purple-500 animate-spin" />
              </div>
            )}
            {state === 'speaking' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 bg-green-500/20 rounded-full animate-pulse" />
                <Phone className="absolute w-16 h-16 text-green-500" />
              </div>
            )}
            {state === 'ready' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 bg-green-500/10 rounded-full" />
                <Mic className="absolute w-16 h-16 text-green-500" />
              </div>
            )}
          </div>
          <p className="text-xl text-gray-700">{stateMessages[state]}</p>
          {state === 'ready' && !micEnabled && (
            <p className="text-sm text-gray-500 mt-2">点击下方按钮开启麦克风开始面试</p>
          )}
        </div>
      </main>

      {/* 底部控制栏 */}
      <footer className="bg-white border-t p-6">
        <div className="max-w-2xl mx-auto flex items-center justify-center gap-4">
          {/* 麦克风控制 */}
          <Button
            size="lg"
            variant={micEnabled ? 'default' : 'outline'}
            className={`rounded-full w-16 h-16 ${micEnabled ? 'bg-blue-500 hover:bg-blue-600' : ''}`}
            onClick={micEnabled ? disableMic : enableMic}
            disabled={state === 'connecting'}
          >
            {micEnabled ? (
              <Mic className="w-6 h-6" />
            ) : (
              <MicOff className="w-6 h-6" />
            )}
          </Button>

          {/* 结束面试 */}
          <Button
            size="lg"
            variant="destructive"
            className="rounded-full w-16 h-16"
            onClick={endInterview}
            disabled={state === 'connecting'}
          >
            <PhoneOff className="w-6 h-6" />
          </Button>
        </div>
      </footer>
    </div>
  )
}