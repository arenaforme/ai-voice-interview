/**
 * 实时面试 WebSocket Hook
 * 处理与后端 WebSocket 服务器的通信
 */
import { useState, useEffect, useRef, useCallback } from 'react'

interface InterviewState {
  status: 'connecting' | 'connected' | 'recording' | 'processing' | 'playing' | 'completed' | 'error'
  currentRound: number
  minRounds: number
  maxRounds: number
  transcript: string
  isTranscriptFinal: boolean
  currentQuestion: string
  error: string | null
}

interface UseRealtimeInterviewOptions {
  token: string
  onQuestionReceived?: (question: string, audio: string) => void
  onCompleted?: () => void
}

export function useRealtimeInterview({ token, onQuestionReceived, onCompleted }: UseRealtimeInterviewOptions) {
  const [state, setState] = useState<InterviewState>({
    status: 'connecting',
    currentRound: 0,
    minRounds: 5,
    maxRounds: 10,
    transcript: '',
    isTranscriptFinal: false,
    currentQuestion: '',
    error: null
  })

  const wsRef = useRef<WebSocket | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // 连接 WebSocket
  useEffect(() => {
    // WebSocket 服务器运行在独立端口 3001
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsHost = process.env.NEXT_PUBLIC_WS_HOST || `${window.location.hostname}:3001`
    const wsUrl = `${protocol}//${wsHost}/api/realtime?token=${token}`

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[WS] Connected')
      setState(prev => ({ ...prev, status: 'connected' }))
    }

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      handleServerMessage(message)
    }

    ws.onerror = (error) => {
      console.error('[WS] Error:', error)
      setState(prev => ({ ...prev, status: 'error', error: '连接错误' }))
    }

    ws.onclose = (event) => {
      console.log('[WS] Closed:', event.code, event.reason)
      if (event.code !== 1000) {
        setState(prev => ({ ...prev, status: 'error', error: event.reason || '连接断开' }))
      }
    }

    return () => {
      ws.close()
      stopRecording()
    }
  }, [token])

  // 处理服务器消息
  const handleServerMessage = useCallback((message: { type: string; data: Record<string, unknown> }) => {
    switch (message.type) {
      case 'connected':
        setState(prev => ({
          ...prev,
          status: 'connected',
          currentRound: message.data.currentRound as number,
          minRounds: message.data.minRounds as number,
          maxRounds: message.data.maxRounds as number
        }))
        break

      case 'transcript':
        setState(prev => ({
          ...prev,
          transcript: message.data.text as string,
          isTranscriptFinal: message.data.isFinal as boolean
        }))
        break

      case 'processing':
        setState(prev => ({ ...prev, status: 'processing' }))
        break

      case 'generating':
        setState(prev => ({ ...prev, status: 'processing' }))
        break

      case 'question':
        setState(prev => ({
          ...prev,
          status: 'playing',
          currentQuestion: message.data.question as string,
          currentRound: message.data.currentRound as number,
          transcript: ''
        }))
        onQuestionReceived?.(message.data.question as string, message.data.audio as string)
        break

      case 'completed':
        setState(prev => ({ ...prev, status: 'completed' }))
        onCompleted?.()
        break

      case 'error':
        setState(prev => ({
          ...prev,
          status: 'error',
          error: message.data.message as string
        }))
        break

      case 'ready':
        // 恢复到可录音状态
        setState(prev => ({ ...prev, status: 'connected' }))
        break
    }
  }, [onQuestionReceived, onCompleted])

  // 开始面试
  const startInterview = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'start_interview' }))
  }, [])

  // 开始录音
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 24000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        }
      })

      streamRef.current = stream

      // 创建 AudioContext 用于转换音频格式
      const audioContext = new AudioContext({ sampleRate: 24000 })
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0)
        // 转换为 Int16
        const int16Data = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          int16Data[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768))
        }
        // 发送到服务器
        const base64 = btoa(String.fromCharCode(...new Uint8Array(int16Data.buffer)))
        wsRef.current?.send(JSON.stringify({ type: 'audio', data: base64 }))
      }

      source.connect(processor)
      processor.connect(audioContext.destination)

      wsRef.current?.send(JSON.stringify({ type: 'start_recording' }))
      setState(prev => ({ ...prev, status: 'recording', transcript: '' }))

    } catch (error) {
      console.error('[Recording] Error:', error)
      setState(prev => ({ ...prev, error: '无法访问麦克风' }))
    }
  }, [])

  // 停止录音
  const stopRecording = useCallback(() => {
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }

    wsRef.current?.send(JSON.stringify({ type: 'stop_recording' }))
    setState(prev => ({ ...prev, status: 'processing' }))
  }, [])

  // 音频播放完成后的回调
  const onAudioEnded = useCallback(() => {
    setState(prev => ({ ...prev, status: 'connected' }))
  }, [])

  return {
    ...state,
    startInterview,
    startRecording,
    stopRecording,
    onAudioEnded
  }
}
