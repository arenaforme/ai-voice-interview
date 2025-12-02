'use client'

import { useState, useEffect, useRef, use } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { useAudioRecorder } from '@/hooks/useAudioRecorder'
import { Mic, Square, Loader2, Volume2 } from 'lucide-react'

interface InterviewState {
  token: string
  positionName: string
  candidateName: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
  currentRound: number
  minRounds: number
  maxRounds: number
  currentQuestion: {
    roundNumber: number
    questionText: string
    questionAudioUrl: string | null
    dimension: string
  } | null
}

export default function InterviewPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const [state, setState] = useState<InterviewState | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [playingAudio, setPlayingAudio] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const recorder = useAudioRecorder()

  // 获取面试状态
  useEffect(() => {
    fetchInterviewState()
  }, [token])

  const fetchInterviewState = async () => {
    try {
      const res = await fetch(`/api/interview/candidate/${token}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '获取面试信息失败')
        return
      }

      setState(data.data)
    } catch {
      setError('网络错误，请刷新重试')
    } finally {
      setLoading(false)
    }
  }

  // 开始面试
  const handleStart = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/interview/candidate/${token}/start`, {
        method: 'POST',
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '开始面试失败')
        return
      }

      setState((prev) =>
        prev
          ? {
              ...prev,
              status: 'IN_PROGRESS',
              currentRound: 1,
              minRounds: data.data.progress?.min || prev.minRounds,
              maxRounds: data.data.progress?.max || prev.maxRounds,
              currentQuestion: data.data.question,
            }
          : null
      )

      // 自动播放问题音频
      if (data.data.question.questionAudioUrl) {
        playQuestionAudio(data.data.question.questionAudioUrl)
      }
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 播放问题音频
  const playQuestionAudio = (url: string) => {
    if (audioRef.current) {
      audioRef.current.src = url
      audioRef.current.play()
      setPlayingAudio(true)
    }
  }

  // 提交回答
  const handleSubmit = async () => {
    if (!recorder.audioBlob) return

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('audio', recorder.audioBlob, 'answer.webm')
      formData.append('duration', recorder.duration.toString())

      const res = await fetch(`/api/interview/candidate/${token}/submit`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '提交失败')
        return
      }

      recorder.resetRecording()

      if (data.data.isComplete) {
        setState((prev) => (prev ? { ...prev, status: 'COMPLETED' } : null))
      } else {
        setState((prev) =>
          prev
            ? {
                ...prev,
                currentRound: data.data.nextQuestion.roundNumber,
                currentQuestion: data.data.nextQuestion,
              }
            : null
        )

        if (data.data.nextQuestion.questionAudioUrl) {
          playQuestionAudio(data.data.nextQuestion.questionAudioUrl)
        }
      }
    } catch {
      setError('网络错误，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (error && !state) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!state) return null

  // 面试完成页面
  if (state.status === 'COMPLETED') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-center">面试已完成</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              感谢您参加 {state.positionName} 岗位的面试
            </p>
            <p>我们会尽快与您联系，请保持电话畅通。</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <audio
        ref={audioRef}
        onEnded={() => setPlayingAudio(false)}
        className="hidden"
      />

      <div className="max-w-2xl mx-auto space-y-6">
        {/* 头部信息 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">
              {state.positionName} - AI 面试
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>候选人：{state.candidateName}</span>
              <span>
                第 {state.currentRound} 题（{state.minRounds}-{state.maxRounds} 题）
              </span>
            </div>
            <Progress
              value={(state.currentRound / state.maxRounds) * 100}
              className="mt-2"
            />
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* 等待开始 - 包括 PENDING 状态和 IN_PROGRESS 但没有当前问题的边界情况 */}
        {(state.status === 'PENDING' || (state.status === 'IN_PROGRESS' && !state.currentQuestion)) && (
          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <p>准备好开始面试了吗？</p>
              <p className="text-sm text-muted-foreground">
                请确保您处于安静的环境，并已授权麦克风权限
              </p>
              <Button onClick={handleStart} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {state.status === 'IN_PROGRESS' ? '继续面试' : '开始面试'}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 面试进行中 */}
        {state.status === 'IN_PROGRESS' && state.currentQuestion && (
          <>
            {/* 问题卡片 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-center">
                  第 {state.currentQuestion.roundNumber} 题
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col items-center justify-center py-4">
                  {playingAudio ? (
                    <div className="flex items-center gap-2 text-primary">
                      <Volume2 className="h-6 w-6 animate-pulse" />
                      <span>正在播放问题...</span>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">请仔细听取问题</p>
                  )}
                </div>
                {state.currentQuestion.questionAudioUrl && (
                  <div className="flex justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        playQuestionAudio(state.currentQuestion!.questionAudioUrl!)
                      }
                      disabled={playingAudio}
                    >
                      <Volume2 className="h-4 w-4 mr-2" />
                      {playingAudio ? '播放中...' : '重新播放'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 录音卡片 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">您的回答</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-center gap-4">
                  {!recorder.isRecording && !recorder.audioBlob && (
                    <Button
                      size="lg"
                      onClick={recorder.startRecording}
                      className="rounded-full h-16 w-16"
                    >
                      <Mic className="h-6 w-6" />
                    </Button>
                  )}

                  {recorder.isRecording && (
                    <>
                      <div className="text-2xl font-mono">
                        {formatTime(recorder.duration)}
                      </div>
                      <Button
                        size="lg"
                        variant="destructive"
                        onClick={recorder.stopRecording}
                        className="rounded-full h-16 w-16"
                      >
                        <Square className="h-6 w-6" />
                      </Button>
                    </>
                  )}

                  {recorder.audioBlob && !recorder.isRecording && (
                    <div className="flex flex-col items-center gap-4">
                      <p className="text-sm text-muted-foreground">
                        录音时长：{formatTime(recorder.duration)}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={recorder.resetRecording}
                        >
                          重新录制
                        </Button>
                        <Button onClick={handleSubmit} disabled={submitting}>
                          {submitting ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : null}
                          提交回答
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {!recorder.isRecording && !recorder.audioBlob && (
                  <p className="text-center text-sm text-muted-foreground">
                    点击麦克风按钮开始录音
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
