'use client'

import { useEffect, useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Loader2 } from 'lucide-react'

interface Template {
  id: string
  name: string
  questionCount: number
}

interface Position {
  id: string
  name: string
  description: string | null
  status: string
  template: Template
  _count: { interviews: number }
  createdAt: string
}

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    templateId: '',
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [posRes, tplRes] = await Promise.all([
        fetch('/api/positions'),
        fetch('/api/templates'),
      ])
      const posData = await posRes.json()
      const tplData = await tplRes.json()

      setPositions(posData.data || [])
      setTemplates(tplData.data || [])
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!formData.name || !formData.templateId) return

    setCreating(true)
    try {
      const res = await fetch('/api/positions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (res.ok) {
        setDialogOpen(false)
        setFormData({ name: '', description: '', templateId: '' })
        fetchData()
      }
    } catch (error) {
      console.error('Failed to create position:', error)
    } finally {
      setCreating(false)
    }
  }

  const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' }> = {
    ACTIVE: { label: '招聘中', variant: 'default' },
    PAUSED: { label: '已暂停', variant: 'secondary' },
    CLOSED: { label: '已关闭', variant: 'secondary' },
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">岗位管理</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新建岗位
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新建岗位</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">岗位名称</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="请输入岗位名称"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="template">面试模板</Label>
                <Select
                  value={formData.templateId}
                  onValueChange={(v) =>
                    setFormData({ ...formData, templateId: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择面试模板" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((tpl) => (
                      <SelectItem key={tpl.id} value={tpl.id}>
                        {tpl.name} ({tpl.questionCount}题)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">岗位描述</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="请输入岗位描述（可选）"
                />
              </div>
              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={creating || !formData.name || !formData.templateId}
              >
                {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                创建
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : positions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            暂无岗位，点击右上角按钮创建
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {positions.map((position) => (
            <Card key={position.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{position.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      模板：{position.template.name}
                    </p>
                  </div>
                  <Badge variant={statusMap[position.status]?.variant || 'secondary'}>
                    {statusMap[position.status]?.label || position.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    已面试 {position._count.interviews} 人
                  </span>
                  <Link href={`/dashboard/positions/${position.id}`}>
                    <Button variant="outline" size="sm">
                      查看详情
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
