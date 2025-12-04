'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Download, ExternalLink } from 'lucide-react'
import type { Resume } from '@/types'

interface ResumePreviewDialogProps {
  resume: Resume
  onClose: () => void
}

export function ResumePreviewDialog({ resume, onClose }: ResumePreviewDialogProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPreviewUrl()
  }, [resume.id])

  const fetchPreviewUrl = async () => {
    try {
      const res = await fetch(`/api/resumes/${resume.id}/preview`)
      const data = await res.json()
      if (res.ok) {
        setPreviewUrl(data.url)
      } else {
        setError(data.error || '获取预览失败')
      }
    } catch {
      setError('网络错误')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    window.open(`/api/resumes/${resume.id}/download`, '_blank')
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="truncate pr-4">
              {resume.candidateName || resume.fileName}
            </DialogTitle>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-1" />
                下载
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* 候选人信息 */}
        {resume.parseStatus === 'SUCCESS' && (
          <div className="flex-shrink-0 grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-muted rounded-lg text-sm">
            {resume.phone && (
              <div>
                <span className="text-muted-foreground">电话：</span>
                {resume.phone}
              </div>
            )}
            {resume.email && (
              <div>
                <span className="text-muted-foreground">邮箱：</span>
                {resume.email}
              </div>
            )}
            {resume.education && (
              <div>
                <span className="text-muted-foreground">学历：</span>
                {resume.education}
              </div>
            )}
            {resume.school && (
              <div>
                <span className="text-muted-foreground">学校：</span>
                {resume.school}
              </div>
            )}
            {resume.workYears !== null && (
              <div>
                <span className="text-muted-foreground">工作年限：</span>
                {resume.workYears}年
              </div>
            )}
            {resume.expectedSalary && (
              <div>
                <span className="text-muted-foreground">期望薪资：</span>
                {resume.expectedSalary}
              </div>
            )}
            {resume.skills && resume.skills.length > 0 && (
              <div className="col-span-2">
                <span className="text-muted-foreground">技能：</span>
                <div className="inline-flex flex-wrap gap-1 ml-1">
                  {resume.skills.slice(0, 5).map((skill, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))}
                  {resume.skills.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{resume.skills.length - 5}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* PDF 预览区域 */}
        <div className="flex-1 min-h-0 border rounded-lg overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <p>{error}</p>
              <Button variant="outline" className="mt-4" onClick={handleDownload}>
                <Download className="h-4 w-4 mr-1" />
                下载查看
              </Button>
            </div>
          ) : previewUrl ? (
            <iframe
              src={previewUrl}
              className="w-full h-full"
              title="简历预览"
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  )
}
