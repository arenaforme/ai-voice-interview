// OpenAI Realtime API 事件类型定义

export interface SessionConfig {
  modalities: ('text' | 'audio')[]
  voice: string
  instructions: string
  input_audio_format: 'pcm16' | 'g711_ulaw' | 'g711_alaw'
  output_audio_format: 'pcm16' | 'g711_ulaw' | 'g711_alaw'
  input_audio_transcription?: {
    model: string
  }
  turn_detection?: {
    type: 'server_vad'
    threshold?: number
    prefix_padding_ms?: number
    silence_duration_ms?: number
    create_response?: boolean
  } | null
  tools?: Tool[]
}

export interface Tool {
  type: 'function'
  name: string
  description: string
  parameters: Record<string, unknown>
}

// 客户端发送的事件
export type ClientEvent =
  | { type: 'session.update'; session: Partial<SessionConfig> }
  | { type: 'input_audio_buffer.append'; audio: string }
  | { type: 'input_audio_buffer.commit' }
  | { type: 'input_audio_buffer.clear' }
  | { type: 'response.create'; response?: { modalities?: string[] } }
  | { type: 'response.cancel' }
  | { type: 'conversation.item.create'; item: ConversationItem }

export interface ConversationItem {
  type: 'function_call_output'
  call_id: string
  output: string
}

// 服务端发送的事件
export type ServerEvent =
  | { type: 'session.created'; session: SessionConfig }
  | { type: 'session.updated'; session: SessionConfig }
  | { type: 'error'; error: { type: string; code: string; message: string } }
  | { type: 'input_audio_buffer.speech_started' }
  | { type: 'input_audio_buffer.speech_stopped' }
  | { type: 'input_audio_buffer.committed' }
  | { type: 'conversation.item.input_audio_transcription.completed'; transcript: string }
  | { type: 'response.created' }
  | { type: 'response.audio.delta'; delta: string }
  | { type: 'response.audio.done' }
  | { type: 'response.audio_transcript.delta'; delta: string }
  | { type: 'response.audio_transcript.done'; transcript: string }
  | { type: 'response.function_call_arguments.done'; call_id: string; name: string; arguments: string }
  | { type: 'response.done'; response: ResponseData }
  | { type: 'rate_limits.updated' }

export interface ResponseData {
  id: string
  status: 'completed' | 'cancelled' | 'failed'
  output: ResponseOutput[]
}

export interface ResponseOutput {
  type: 'message' | 'function_call'
  content?: Array<{ type: string; transcript?: string }>
  name?: string
  call_id?: string
  arguments?: string
}

// 面试评估数据
export interface EvaluationData {
  dimension: string
  question: string      // 面试官提出的问题
  answer: string        // 候选人的回答内容
  score: number
  analysis: string      // 针对该回答的分析评价
}

// 面试会话状态
export type InterviewState =
  | 'connecting'
  | 'ready'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'ended'
  | 'error'
