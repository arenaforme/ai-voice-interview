'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Plus, Trash2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface QuestionTemplate {
  dimension: string
  sampleQuestions: string[]
}

// 默认系统提示词
const defaultSystemPrompt = `你是一位经验丰富的面试官，正在进行一场真实的面试对话。

## 核心原则
1. 自然对话：像真人面试官一样提问，语气亲切专业
2. 禁止元信息：绝对不要提及"评估维度"、"面试问题"、"考察点"等词汇
3. 追问深入：根据候选人回答自然追问，而非机械切换话题
4. 简洁明了：问题简短有力，一次只问一个问题

## 输出要求
直接输出问题，不要有任何前缀、后缀或解释。`

export default function NewTemplatePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [minQuestions, setMinQuestions] = useState(5)
  const [maxQuestions, setMaxQuestions] = useState(10)
  const [systemPrompt, setSystemPrompt] = useState(defaultSystemPrompt)
  const [questionTemplates, setQuestionTemplates] = useState<QuestionTemplate[]>([
    { dimension: '专业能力', sampleQuestions: [''] },
  ])

  const addDimension = () => {
    setQuestionTemplates([...questionTemplates, { dimension: '', sampleQuestions: [''] }])
  }

  const removeDimension = (index: number) => {
    setQuestionTemplates(questionTemplates.filter((_, i) => i !== index))
  }

  const updateDimension = (index: number, dimension: string) => {
    const updated = [...questionTemplates]
    updated[index].dimension = dimension
    setQuestionTemplates(updated)
  }

  const addQuestion = (dimIndex: number) => {
    const updated = [...questionTemplates]
    updated[dimIndex].sampleQuestions.push('')
    setQuestionTemplates(updated)
  }

  const removeQuestion = (dimIndex: number, qIndex: number) => {
    const updated = [...questionTemplates]
    updated[dimIndex].sampleQuestions = updated[dimIndex].sampleQuestions.filter((_, i) => i !== qIndex)
    setQuestionTemplates(updated)
  }

  const updateQuestion = (dimIndex: number, qIndex: number, value: string) => {
    const updated = [...questionTemplates]
    updated[dimIndex].sampleQuestions[qIndex] = value
    setQuestionTemplates(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    // 过滤空的维度和问题
    const filteredTemplates = questionTemplates
      .filter(t => t.dimension.trim())
      .map(t => ({
        dimension: t.dimension.trim(),
        sampleQuestions: t.sampleQuestions.filter(q => q.trim()),
      }))
      .filter(t => t.sampleQuestions.length > 0)

    const dimensions = filteredTemplates.map(t => t.dimension)

    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          minQuestions,
          maxQuestions,
          dimensions,
          questionTemplates: filteredTemplates,
          systemPrompt,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      router.push('/dashboard/templates')
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/templates">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">新建自定义模板</h1>
          <p className="text-muted-foreground">创建新的面试问题模板</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 基本信息 */}
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">模板名称 *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="如：前端工程师"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">模板描述</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="如：适用于前端开发岗位"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="minQuestions">最少问题数</Label>
                <Input
                  id="minQuestions"
                  type="number"
                  min={1}
                  max={20}
                  value={minQuestions}
                  onChange={(e) => setMinQuestions(Number(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxQuestions">最多问题数</Label>
                <Input
                  id="maxQuestions"
                  type="number"
                  min={1}
                  max={20}
                  value={maxQuestions}
                  onChange={(e) => setMaxQuestions(Number(e.target.value))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 评估维度和问题 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>评估维度与示例问题</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addDimension}>
              <Plus className="h-4 w-4 mr-2" />
              添加维度
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {questionTemplates.map((template, dimIndex) => (
              <div key={dimIndex} className="border rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label>维度名称</Label>
                    <Input
                      value={template.dimension}
                      onChange={(e) => updateDimension(dimIndex, e.target.value)}
                      placeholder="如：专业能力"
                    />
                  </div>
                  {questionTemplates.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDimension(dimIndex)}
                      className="text-destructive mt-6"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>示例问题</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => addQuestion(dimIndex)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      添加问题
                    </Button>
                  </div>
                  {template.sampleQuestions.map((question, qIndex) => (
                    <div key={qIndex} className="flex items-center gap-2">
                      <Input
                        value={question}
                        onChange={(e) => updateQuestion(dimIndex, qIndex, e.target.value)}
                        placeholder="输入示例问题..."
                      />
                      {template.sampleQuestions.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeQuestion(dimIndex, qIndex)}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 系统提示词 */}
        <Card>
          <CardHeader>
            <CardTitle>系统提示词</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              rows={10}
              placeholder="输入面试官的系统提示词..."
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Link href="/dashboard/templates">
            <Button type="button" variant="outline">取消</Button>
          </Link>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            创建模板
          </Button>
        </div>
      </form>
    </div>
  )
}
