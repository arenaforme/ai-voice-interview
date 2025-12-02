'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Plus, Loader2, Copy, Check } from 'lucide-react'

interface Interview {
  id: string
  token: string
  candidateName: string
  candidateEmail: string | null
  status: string
  createdAt: string
  completedAt: string | null
  report: { recommendation: string } | null
}

interface Position {
  id: string
  name: string
  description: string | null
  status: string
  template: { name: string; questionCount: number }
  interviews: Interview[]
}

export default function PositionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [position, setPosition] = useState<Position | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [newLink, setNewLink] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    candidateName: '',
    candidateEmail: '',
    candidatePhone: '',
  })

  useEffect(() => {
    fetchPosition()
  }, [id])

  const fetchPosition = async () => {
    try {
      const res = await fetch(`/api/positions/${id}`)
      const data = await res.json()
      setPosition(data.data)
    } catch (error) {
      console.error('Failed to fetch position:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateInterview = async () => {
    if (!formData.candidateName) return

    setCreating(true)
    try {
      const res = await fetch('/api/interviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId: id, ...formData }),
      })

      const data = await res.json()
      if (res.ok) {
        const link = `${window.location.origin}/interview/${data.data.token}`
        setNewLink(link)
        setFormData({ candidateName: '', candidateEmail: '', candidatePhone: '' })
        fetchPosition()
      }
    } catch (error) {
      console.error('Failed to create interview:', error)
    } finally {
      setCreating(false)
    }
  }

  const copyLink = (token: string) => {
    const link = `${window.location.origin}/interview/${token}`
    navigator.clipboard.writeText(link)
    setCopied(token)
    setTimeout(() => setCopied(null), 2000)
  }

  const statusMap: Record<string, { label: string; color: string }> = {
    PENDING: { label: '待面试', color: 'bg-yellow-100 text-yellow-800' },
    IN_PROGRESS: { label: '进行中', color: 'bg-blue-100 text-blue-800' },
    COMPLETED: { label: '已完成', color: 'bg-green-100 text-green-800' },
  }

  const recommendationMap: Record<string, string> = {
    RECOMMENDED: '推荐',
    CAUTIOUS: '谨慎推荐',
    NOT_RECOMMENDED: '不推荐',
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!position) {
    return (
      <Alert variant="destructive">
        <AlertDescription>岗位不存在</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/positions">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{position.name}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">岗位信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">面试模板：</span>
            {position.template.name} ({position.template.questionCount}题)
          </p>
          {position.description && (
            <p>
              <span className="text-muted-foreground">描述：</span>
              {position.description}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">
          面试列表 ({position.interviews.length})
        </h2>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setNewLink(null)
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              生成面试链接
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>生成面试链接</DialogTitle>
            </DialogHeader>
            {newLink ? (
              <div className="space-y-4 pt-4">
                <Alert>
                  <AlertDescription>面试链接已生成，请复制发送给候选人</AlertDescription>
                </Alert>
                <div className="flex gap-2">
                  <Input value={newLink} readOnly />
                  <Button
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(newLink)
                      setCopied('new')
                    }}
                  >
                    {copied === 'new' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => {
                    setNewLink(null)
                    setDialogOpen(false)
                  }}
                >
                  完成
                </Button>
              </div>
            ) : (
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="candidateName">候选人姓名 *</Label>
                  <Input
                    id="candidateName"
                    value={formData.candidateName}
                    onChange={(e) =>
                      setFormData({ ...formData, candidateName: e.target.value })
                    }
                    placeholder="请输入候选人姓名"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="candidateEmail">邮箱</Label>
                  <Input
                    id="candidateEmail"
                    type="email"
                    value={formData.candidateEmail}
                    onChange={(e) =>
                      setFormData({ ...formData, candidateEmail: e.target.value })
                    }
                    placeholder="请输入邮箱（可选）"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="candidatePhone">电话</Label>
                  <Input
                    id="candidatePhone"
                    value={formData.candidatePhone}
                    onChange={(e) =>
                      setFormData({ ...formData, candidatePhone: e.target.value })
                    }
                    placeholder="请输入电话（可选）"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleCreateInterview}
                  disabled={creating || !formData.candidateName}
                >
                  {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  生成链接
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {position.interviews.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            暂无面试记录
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {position.interviews.map((interview) => (
            <Card key={interview.id}>
              <CardContent className="py-4">
                <div className="flex justify-between items-center">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{interview.candidateName}</span>
                      <Badge
                        className={statusMap[interview.status]?.color || ''}
                        variant="secondary"
                      >
                        {statusMap[interview.status]?.label || interview.status}
                      </Badge>
                      {interview.report && (
                        <Badge variant="outline">
                          {recommendationMap[interview.report.recommendation] ||
                            interview.report.recommendation}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      创建于 {new Date(interview.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyLink(interview.token)}
                    >
                      {copied === interview.token ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Link href={`/dashboard/interviews/${interview.id}`}>
                      <Button variant="outline" size="sm">
                        查看详情
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
