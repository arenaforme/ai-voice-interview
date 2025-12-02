'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Plus, Trash2, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react'

interface QuestionTemplate {
  dimension: string
  sampleQuestions: string[]
}

interface Template {
  id: string
  name: string
  description: string | null
  dimensions: string[]
  questionTemplates: QuestionTemplate[] | null
}

export default function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [template, setTemplate] = useState<Template | null>(null)
  const [questions, setQuestions] = useState<QuestionTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [expandedDimensions, setExpandedDimensions] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchTemplate()
  }, [id])

  const fetchTemplate = async () => {
    try {
      const res = await fetch(`/api/templates/${id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      setTemplate(data.data)
      const dims = data.data.dimensions as string[]
      const existingQuestions = data.data.questionTemplates as QuestionTemplate[] | null

      // 初始化问题模板
      const initialQuestions = dims.map(dim => {
        const existing = existingQuestions?.find(q => q.dimension === dim)
        return existing || { dimension: dim, sampleQuestions: [''] }
      })
      setQuestions(initialQuestions)
      setExpandedDimensions(new Set(dims))
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const toggleDimension = (dim: string) => {
    const newSet = new Set(expandedDimensions)
    if (newSet.has(dim)) {
      newSet.delete(dim)
    } else {
      newSet.add(dim)
    }
    setExpandedDimensions(newSet)
  }

  const updateQuestion = (dimIndex: number, qIndex: number, value: string) => {
    const newQuestions = [...questions]
    newQuestions[dimIndex].sampleQuestions[qIndex] = value
    setQuestions(newQuestions)
  }

  const addQuestion = (dimIndex: number) => {
    const newQuestions = [...questions]
    newQuestions[dimIndex].sampleQuestions.push('')
    setQuestions(newQuestions)
  }

  const removeQuestion = (dimIndex: number, qIndex: number) => {
    const newQuestions = [...questions]
    if (newQuestions[dimIndex].sampleQuestions.length > 1) {
      newQuestions[dimIndex].sampleQuestions.splice(qIndex, 1)
      setQuestions(newQuestions)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      // 过滤空问题
      const filtered = questions.map(q => ({
        ...q,
        sampleQuestions: q.sampleQuestions.filter(s => s.trim())
      }))

      const res = await fetch(`/api/templates/${id}/questions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionTemplates: filtered }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      router.push('/dashboard/templates')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!confirm('确定要恢复默认问题模板吗？当前修改将丢失。')) return

    setLoading(true)
    try {
      const res = await fetch(`/api/templates/${id}/reset`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      await fetchTemplate()
    } catch (err) {
      setError(err instanceof Error ? err.message : '重置失败')
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!template) {
    return (
      <Alert variant="destructive">
        <AlertDescription>模板不存在</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">编辑面试模板</h1>
          <p className="text-muted-foreground">{template.name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            恢复默认
          </Button>
          <Button variant="outline" onClick={() => router.back()}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            保存
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {questions.map((q, dimIndex) => (
          <Card key={q.dimension}>
            <CardHeader
              className="cursor-pointer"
              onClick={() => toggleDimension(q.dimension)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {expandedDimensions.has(q.dimension) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <CardTitle className="text-base">{q.dimension}</CardTitle>
                </div>
                <span className="text-sm text-muted-foreground">
                  {q.sampleQuestions.filter(s => s.trim()).length} 个问题
                </span>
              </div>
            </CardHeader>
            {expandedDimensions.has(q.dimension) && (
              <CardContent className="space-y-3">
                {q.sampleQuestions.map((question, qIndex) => (
                  <div key={qIndex} className="flex gap-2">
                    <span className="text-muted-foreground w-6 pt-2">{qIndex + 1}.</span>
                    <Input
                      value={question}
                      onChange={(e) => updateQuestion(dimIndex, qIndex, e.target.value)}
                      placeholder="输入示例问题..."
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeQuestion(dimIndex, qIndex)}
                      disabled={q.sampleQuestions.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => addQuestion(dimIndex)}
                  className="ml-6"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  添加问题
                </Button>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
