'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Briefcase, Users, CheckCircle, Clock } from 'lucide-react'

interface DashboardStats {
  totalPositions: number
  totalInterviews: number
  completedInterviews: number
  pendingInterviews: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalPositions: 0,
    totalInterviews: 0,
    completedInterviews: 0,
    pendingInterviews: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const [positionsRes, interviewsRes] = await Promise.all([
        fetch('/api/positions'),
        fetch('/api/interviews'),
      ])

      const positions = await positionsRes.json()
      const interviews = await interviewsRes.json()

      const interviewList = interviews.data || []

      setStats({
        totalPositions: positions.data?.length || 0,
        totalInterviews: interviewList.length,
        completedInterviews: interviewList.filter(
          (i: { status: string }) => i.status === 'COMPLETED'
        ).length,
        pendingInterviews: interviewList.filter(
          (i: { status: string }) => i.status === 'PENDING'
        ).length,
      })
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    {
      title: '岗位总数',
      value: stats.totalPositions,
      icon: Briefcase,
      color: 'text-blue-600',
    },
    {
      title: '面试总数',
      value: stats.totalInterviews,
      icon: Users,
      color: 'text-purple-600',
    },
    {
      title: '已完成',
      value: stats.completedInterviews,
      icon: CheckCircle,
      color: 'text-green-600',
    },
    {
      title: '待面试',
      value: stats.pendingInterviews,
      icon: Clock,
      color: 'text-orange-600',
    },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">概览</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loading ? '-' : card.value}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
