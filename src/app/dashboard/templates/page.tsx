'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Loader2, Edit, FileText, Plus, Copy, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'

interface Template {
  id: string
  name: string
  description: string | null
  minQuestions: number
  maxQuestions: number
  dimensions: string[]
  questionTemplates: Array<{ dimension: string; sampleQuestions: string[] }> | null
  isSystem: boolean
  isActive: boolean
  _count?: { positions: number }
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const fetchTemplates = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filterType !== 'all') params.set('isSystem', filterType === 'system' ? 'true' : 'false')
      if (filterStatus !== 'all') params.set('isActive', filterStatus === 'active' ? 'true' : 'false')

      const res = await fetch(`/api/templates?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTemplates(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [filterType, filterStatus])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const handleToggleStatus = async (id: string) => {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/templates/${id}/status`, { method: 'PATCH' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      await fetchTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setActionLoading(null)
    }
  }

  const handleCopy = async (id: string) => {
    setActionLoading(id)
    try {
      const res = await fetch(`/api/templates/${id}/copy`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      await fetchTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : '复制失败')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setActionLoading(deleteId)
    try {
      const res = await fetch(`/api/templates/${deleteId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }
      await fetchTemplates()
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    } finally {
      setActionLoading(null)
      setDeleteId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">面试模板管理</h1>
          <p className="text-muted-foreground">管理各岗位的面试问题模板</p>
        </div>
        <Link href="/dashboard/templates/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            新建自定义模板
          </Button>
        </Link>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 筛选器 */}
      <div className="flex gap-4">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="模板类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部类型</SelectItem>
            <SelectItem value="system">系统模板</SelectItem>
            <SelectItem value="custom">自定义模板</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="状态" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem value="active">可用</SelectItem>
            <SelectItem value="inactive">不可用</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => {
          const questionCount = template.questionTemplates?.reduce(
            (sum, t) => sum + t.sampleQuestions.length, 0
          ) || 0
          const isLoading = actionLoading === template.id

          return (
            <Card key={template.id} className={!template.isActive ? 'opacity-60' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {template.name}
                    </CardTitle>
                    <CardDescription>{template.description}</CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Badge variant={template.isSystem ? 'default' : 'secondary'}>
                      {template.isSystem ? '系统' : '自定义'}
                    </Badge>
                    <Badge variant={template.isActive ? 'default' : 'outline'}>
                      {template.isActive ? '可用' : '不可用'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>问题数：{template.minQuestions}-{template.maxQuestions} 题</p>
                  <p>评估维度：{template.dimensions.length} 个</p>
                  <p>示例问题：{questionCount} 个</p>
                  {template._count && template._count.positions > 0 && (
                    <p>关联岗位：{template._count.positions} 个</p>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/dashboard/templates/${template.id}/edit`}>
                    <Button variant="outline" size="sm" disabled={isLoading}>
                      <Edit className="h-4 w-4 mr-1" />
                      编辑
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleStatus(template.id)}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : template.isActive ? (
                      <><ToggleRight className="h-4 w-4 mr-1" />禁用</>
                    ) : (
                      <><ToggleLeft className="h-4 w-4 mr-1" />启用</>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(template.id)}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <><Copy className="h-4 w-4 mr-1" />复制</>
                    )}
                  </Button>
                  {!template.isSystem && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteId(template.id)}
                      disabled={isLoading}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      删除
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {templates.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          暂无模板
        </div>
      )}

      {/* 删除确认对话框 */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除这个模板吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
