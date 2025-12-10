'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { SimplePagination } from '@/components/ui/simple-pagination'

interface Interview {
  id: string
  candidateName: string
  status: string
  mode: 'MANUAL' | 'REALTIME'
  createdAt: string
  completedAt: string | null
  position: { name: string }
  report: { recommendation: string } | null
}

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const pageSize = 10

  useEffect(() => {
    fetchInterviews()
  }, [statusFilter, currentPage])

  const fetchInterviews = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter !== 'all') {
        params.set('status', statusFilter)
      }
      params.set('page', currentPage.toString())
      params.set('pageSize', pageSize.toString())

      const res = await fetch(`/api/interviews?${params}`)
      const data = await res.json()
      setInterviews(data.data || [])
      setTotalPages(data.pagination?.totalPages || 1)
    } catch (error) {
      console.error('Failed to fetch interviews:', error)
    } finally {
      setLoading(false)
    }
  }

  // 筛选变化时重置页码
  const handleStatusChange = (value: string) => {
    setStatusFilter(value)
    setCurrentPage(1)
  }

  const statusMap: Record<string, { label: string; color: string }> = {
    PENDING: { label: '待面试', color: 'bg-yellow-100 text-yellow-800' },
    IN_PROGRESS: { label: '进行中', color: 'bg-blue-100 text-blue-800' },
    COMPLETED: { label: '已完成', color: 'bg-green-100 text-green-800' },
  }

  const recommendationMap: Record<string, { label: string; color: string }> = {
    RECOMMENDED: { label: '推荐', color: 'bg-green-100 text-green-800' },
    CAUTIOUS: { label: '谨慎推荐', color: 'bg-yellow-100 text-yellow-800' },
    NOT_RECOMMENDED: { label: '不推荐', color: 'bg-red-100 text-red-800' },
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">面试管理</h1>
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="PENDING">待面试</SelectItem>
            <SelectItem value="IN_PROGRESS">进行中</SelectItem>
            <SelectItem value="COMPLETED">已完成</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : interviews.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            暂无面试记录
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {interviews.map((interview) => (
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
                      <Badge
                        variant="outline"
                        className={interview.mode === 'REALTIME' ? 'border-purple-500 text-purple-600' : ''}
                      >
                        {interview.mode === 'REALTIME' ? '实时语音' : '传统模式'}
                      </Badge>
                      {interview.report && (
                        <Badge
                          className={
                            recommendationMap[interview.report.recommendation]?.color || ''
                          }
                          variant="secondary"
                        >
                          {recommendationMap[interview.report.recommendation]?.label ||
                            interview.report.recommendation}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {interview.position.name} ·{' '}
                      {new Date(interview.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Link href={`/dashboard/interviews/${interview.id}`}>
                    <Button variant="outline" size="sm">
                      查看详情
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
          <SimplePagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  )
}
