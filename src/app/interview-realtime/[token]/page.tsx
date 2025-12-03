'use client'

import { use, useRef, useCallback, useEffect, useState } from 'react'
import { useRealtimeInterview } from '@/hooks/useRealtimeInterview'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Mic, MicOff, Loader2, CheckCircle } from 'lucide-react'

export default function RealtimeInterviewPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [interviewStarted, setInterviewStarted] = useState(false)
  const [micPermission, setMicPermission] = useState<'pending' | 'granted' | 'denied'>('pending')

  // 播放问题音频
  const handleQuestionReceived = useCallback((question: string, audioBase64: string) => {
    if (audioRef.current) {
      const audioBlob = new Blob(
        [Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0))],
        { type: 'audio/mp3' }
      )
      audioRef.current.src = URL.createObjectURL(audioBlob)
      audioRef.current.play()
    }
  }, [])

  const {
    status,
    currentRound,
    minRounds,
    maxRounds,
    error,
    startInterview,
    startRecording,
    stopRecording,
    onAudioEnded
  } = useRealtimeInterview({
    token,
    onQuestionReceived: handleQuestionReceived
  })

  // 检查麦克风权限
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(() => setMicPermission('granted'))
      .catch(() => setMicPermission('denied'))
  }, [])

  // 开始面试
  const handleStartInterview = () => {
    setInterviewStarted(true)
    startInterview()
  }

  // 音频播放结束
  const handleAudioEnded = () => {
    onAudioEnded()
  }

  // 麦克风权限被拒绝
  if (micPermission === 'denied') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 to-slate-800">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>
            需要麦克风权限才能进行面试。请在浏览器设置中允许麦克风访问，然后刷新页面。
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  // 错误状态
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 to-slate-800">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  // 面试完成
  if (status === 'completed') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 to-slate-800">
        <Card className="max-w-md w-full bg-slate-800/50 border-slate-700">
          <CardContent className="py-12 text-center space-y-6">
            <div className="relative mx-auto w-24 h-24">
              <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />
              <div className="relative flex items-center justify-center w-24 h-24 bg-green-500/30 rounded-full">
                <CheckCircle className="h-12 w-12 text-green-400" />
              </div>
            </div>
            <h2 className="text-2xl font-semibold text-white">面试已完成</h2>
            <p className="text-slate-400">
              感谢您参加本次面试！您的面试结果将由 HR 审核后通知您。
            </p>
            <p className="text-sm text-slate-500">
              共完成 {currentRound} 道问题
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col">
      {/* 顶部进度条 */}
      <div className="p-4">
        <div className="max-w-md mx-auto">
          <div className="flex justify-between text-sm text-slate-400 mb-2">
            <span>AI 语音面试</span>
            <span>{currentRound} / {minRounds}-{maxRounds} 题</span>
          </div>
          <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
              style={{ width: `${(currentRound / maxRounds) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* 主交互区域 */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center space-y-8">
          {/* 动态交互圆 */}
          <div className="relative">
            {/* 面试开始前 */}
            {!interviewStarted && (
              <button
                onClick={handleStartInterview}
                disabled={status === 'connecting'}
                className="group relative w-48 h-48 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500
                         hover:from-blue-500 hover:to-cyan-400 transition-all duration-300
                         shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40
                         disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="absolute inset-2 rounded-full bg-slate-900/50 flex items-center justify-center">
                  {status === 'connecting' ? (
                    <Loader2 className="h-16 w-16 text-white animate-spin" />
                  ) : (
                    <div className="text-white">
                      <div className="text-lg font-medium">点击开始</div>
                      <div className="text-sm opacity-75">AI 面试</div>
                    </div>
                  )}
                </div>
                {/* 外圈动画 */}
                <div className="absolute -inset-4 rounded-full border-2 border-blue-400/30 animate-pulse" />
              </button>
            )}

            {/* AI 播放问题中 */}
            {interviewStarted && status === 'playing' && (
              <div className="relative w-48 h-48">
                {/* 声波动画背景 */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-600 to-blue-500 animate-pulse" />
                <div className="absolute inset-2 rounded-full bg-slate-900/80 flex items-center justify-center">
                  {/* 声波条 */}
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={i}
                        className="w-2 bg-cyan-400 rounded-full animate-soundwave"
                        style={{
                          animationDelay: `${i * 0.1}s`,
                          height: '40px'
                        }}
                      />
                    ))}
                  </div>
                </div>
                {/* 外圈光晕 */}
                <div className="absolute -inset-4 rounded-full bg-cyan-500/20 animate-ping" />
                <div className="absolute -inset-8 rounded-full border border-cyan-400/20" />
              </div>
            )}

            {/* 等待回答 / 已连接 */}
            {interviewStarted && status === 'connected' && (
              <button
                onClick={startRecording}
                className="group relative w-48 h-48 rounded-full bg-gradient-to-br from-green-600 to-emerald-500
                         hover:from-green-500 hover:to-emerald-400 transition-all duration-300
                         shadow-lg shadow-green-500/25 hover:shadow-green-500/40"
              >
                <div className="absolute inset-2 rounded-full bg-slate-900/50 flex items-center justify-center">
                  <Mic className="h-16 w-16 text-white group-hover:scale-110 transition-transform" />
                </div>
                {/* 呼吸动画 */}
                <div className="absolute -inset-4 rounded-full border-2 border-green-400/30 animate-pulse" />
              </button>
            )}

            {/* 录音中 */}
            {interviewStarted && status === 'recording' && (
              <button
                onClick={stopRecording}
                className="group relative w-48 h-48"
              >
                {/* 脉冲动画 */}
                <div className="absolute inset-0 rounded-full bg-red-500 animate-pulse" />
                <div className="absolute -inset-4 rounded-full bg-red-500/30 animate-ping" />
                <div className="absolute -inset-8 rounded-full bg-red-500/20 animate-ping" style={{ animationDelay: '0.2s' }} />
                <div className="absolute inset-2 rounded-full bg-slate-900/80 flex items-center justify-center">
                  <MicOff className="h-16 w-16 text-red-400" />
                </div>
                {/* 录音指示点 */}
                <div className="absolute top-4 right-4 w-4 h-4 bg-red-500 rounded-full animate-pulse" />
              </button>
            )}

            {/* 处理中 */}
            {interviewStarted && status === 'processing' && (
              <div className="relative w-48 h-48">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-600 to-pink-500">
                  {/* 旋转边框 */}
                  <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-white/50 animate-spin" />
                </div>
                <div className="absolute inset-2 rounded-full bg-slate-900/80 flex items-center justify-center">
                  <Loader2 className="h-16 w-16 text-purple-400 animate-spin" />
                </div>
                {/* 外圈 */}
                <div className="absolute -inset-4 rounded-full border border-purple-400/30 animate-pulse" />
              </div>
            )}
          </div>

          {/* 状态提示文字 */}
          <div className="h-8">
            {!interviewStarted && status !== 'connecting' && (
              <p className="text-slate-400 animate-fade-in">准备好后，点击上方按钮开始面试</p>
            )}
            {!interviewStarted && status === 'connecting' && (
              <p className="text-slate-400 animate-pulse">正在连接...</p>
            )}
            {interviewStarted && status === 'playing' && (
              <p className="text-cyan-400 animate-pulse">AI 正在提问，请仔细聆听...</p>
            )}
            {interviewStarted && status === 'connected' && (
              <p className="text-green-400 animate-fade-in">点击麦克风开始回答</p>
            )}
            {interviewStarted && status === 'recording' && (
              <p className="text-red-400 animate-pulse">正在录音，点击停止...</p>
            )}
            {interviewStarted && status === 'processing' && (
              <p className="text-purple-400 animate-pulse">正在处理您的回答...</p>
            )}
          </div>
        </div>
      </div>

      {/* 隐藏的音频播放器 */}
      <audio ref={audioRef} onEnded={handleAudioEnded} className="hidden" />
    </div>
  )
}
