'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Loader2 } from 'lucide-react'

interface Round {
  id: string
  roundNumber: number
  dimension: string
  questionText: string
  answerText: string | null
  score: number | null
  evaluation: string | null
  durationSeconds: number | null
}

interface Report {
  dimensionScores: Record<string, number>
  strengths: string[]
  risks: string[]
  recommendation: string
  summary: string
}

interface Interview {
  id: string
  candidateName: string
  candidateEmail: string | null
  candidatePhone: string | null
  status: string
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  hrDecision: string | null
  hrComment: string | null
  position: { name: string; template: { name: string } }
  rounds: Round[]
  report: Report | null
}

export default function InterviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [interview, setInterview] = useState<Interview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchInterview()
  }, [id])

  const fetchInterview = async () => {
    try {
      const res = await fetch(`/api/interviews/${id}`)
      const data = await res.json()
      setInterview(data.data)
    } catch (error) {
      console.error('Failed to fetch interview:', error)
    } finally {
      setLoading(false)
    }
  }

  const statusMap: Record<string, { label: string; color: string }> = {
    PENDING: { label: '待面试', color: 'bg-yellow-100 text-yellow-800' },
    IN_PROGRESS: { label: '进行中', color: 'bg-blue-100 text-blue-800' },
    COMPLETED: { label: '已完成', color: 'bg-green-100 text-green-800' },
  }

  const recommendationMap: Record<string, { label: string; color: string }> = {
    RECOMMENDED: { label: '推荐录用', color: 'text-green-600' },
    CAUTIOUS: { label: '谨慎推荐', color: 'text-yellow-600' },
    NOT_RECOMMENDED: { label: '不推荐', color: 'text-red-600' },
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!interview) {
    return (
      <Alert variant="destructive">
        <AlertDescription>面试记录不存在</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/interviews">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{interview.candidateName} 的面试</h1>
        <Badge
          className={statusMap[interview.status]?.color || ''}
          variant="secondary"
        >
          {statusMap[interview.status]?.label || interview.status}
        </Badge>
      </div>

      {/* 基本信息 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本信息</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">岗位：</span>
            {interview.position.name}
          </div>
          <div>
            <span className="text-muted-foreground">模板：</span>
            {interview.position.template.name}
          </div>
          {interview.candidateEmail && (
            <div>
              <span className="text-muted-foreground">邮箱：</span>
              {interview.candidateEmail}
            </div>
          )}
          {interview.candidatePhone && (
            <div>
              <span className="text-muted-foreground">电话：</span>
              {interview.candidatePhone}
            </div>
          )}
          <div>
            <span className="text-muted-foreground">创建时间：</span>
            {new Date(interview.createdAt).toLocaleString()}
          </div>
          {interview.completedAt && (
            <div>
              <span className="text-muted-foreground">完成时间：</span>
              {new Date(interview.completedAt).toLocaleString()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 面试报告 */}
      {interview.report && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              面试报告
              <span
                className={`text-lg font-bold ${
                  recommendationMap[interview.report.recommendation]?.color || ''
                }`}
              >
                {recommendationMap[interview.report.recommendation]?.label ||
                  interview.report.recommendation}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">维度评分</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(interview.report.dimensionScores).map(
                  ([dim, score]) => (
                    <div
                      key={dim}
                      className="flex justify-between bg-muted p-2 rounded"
                    >
                      <span className="text-sm">{dim}</span>
                      <span className="font-medium">{score}分</span>
                    </div>
                  )
                )}
              </div>
            </div>

            <Separator />

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-medium mb-2 text-green-600">优势</h4>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {interview.report.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-2 text-red-600">风险</h4>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {interview.report.risks.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            </div>

            <Separator />

            <div>
              <h4 className="font-medium mb-2">总结</h4>
              <p className="text-sm text-muted-foreground">
                {interview.report.summary}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 面试记录 */}
      {interview.rounds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">面试记录</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {interview.rounds.map((round) => (
              <div key={round.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">第 {round.roundNumber} 轮</Badge>
                  <span className="text-sm text-muted-foreground">
                    {round.dimension}
                  </span>
                  {round.score !== null && (
                    <Badge variant="secondary">{round.score}分</Badge>
                  )}
                </div>
                <div className="pl-4 border-l-2 space-y-2">
                  <div>
                    <p className="text-sm font-medium">问题</p>
                    <p className="text-sm text-muted-foreground">
                      {round.questionText}
                    </p>
                  </div>
                  {round.answerText && (
                    <div>
                      <p className="text-sm font-medium">回答</p>
                      <p className="text-sm text-muted-foreground">
                        {round.answerText}
                      </p>
                    </div>
                  )}
                  {round.evaluation && (
                    <div>
                      <p className="text-sm font-medium">评价</p>
                      <p className="text-sm text-muted-foreground">
                        {round.evaluation}
                      </p>
                    </div>
                  )}
                </div>
                {round.roundNumber < interview.rounds.length && <Separator />}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
