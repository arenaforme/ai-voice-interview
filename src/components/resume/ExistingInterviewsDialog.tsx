'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Copy, ExternalLink, Plus, Loader2 } from 'lucide-react'

interface ExistingInterview {
  id: string
  token: string
  candidateName: string
  status: string
  createdAt: string
  completedAt: string | null
}

interface ExistingInterviewsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  interviews: ExistingInterview[]
  onCreateNew: () => void
  onCopyLink: (token: string) => void
  creating?: boolean
}

const statusMap: Record<string, { label: string; color: string }> = {
  PENDING: { label: '待开始', color: 'bg-gray-100 text-gray-800' },
  IN_PROGRESS: { label: '进行中', color: 'bg-blue-100 text-blue-800' },
  COMPLETED: { label: '已完成', color: 'bg-green-100 text-green-800' },
  EXPIRED: { label: '已过期', color: 'bg-yellow-100 text-yellow-800' },
}

export function ExistingInterviewsDialog({
  open,
  onOpenChange,
  interviews,
  onCreateNew,
  onCopyLink,
  creating,
}: ExistingInterviewsDialogProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>已有面试链接</DialogTitle>
          <DialogDescription>
            该简历已生成过 {interviews.length} 个面试链接，您可以复制已有链接或创建新的。
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-60 overflow-y-auto space-y-2">
          {interviews.map((interview) => {
            const status = statusMap[interview.status] || statusMap.PENDING
            const canCopy = interview.status === 'PENDING'

            return (
              <div
                key={interview.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate text-sm">
                      {interview.candidateName}
                    </span>
                    <Badge className={status.color} variant="secondary">
                      {status.label}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    创建于 {formatDate(interview.createdAt)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCopyLink(interview.token)}
                  disabled={!canCopy}
                  title={canCopy ? '复制链接' : '面试已开始或完成'}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            )
          })}
        </div>

        <DialogFooter className="flex gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={onCreateNew} disabled={creating}>
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Plus className="h-4 w-4 mr-1" />
            )}
            创建新链接
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
