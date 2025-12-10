'use client'

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Upload,
  Trash2,
  FileText,
  Eye,
  MessageSquare,
  Link as LinkIcon,
  Loader2,
} from 'lucide-react'
import { SimplePagination } from '@/components/ui/simple-pagination'
import type { Resume } from '@/types'
import { ResumeUploadDialog } from './ResumeUploadDialog'
import { ResumePreviewDialog } from './ResumePreviewDialog'
import { ResumeNotesDialog } from './ResumeNotesDialog'
import { ExistingInterviewsDialog } from './ExistingInterviewsDialog'

interface ExistingInterview {
  id: string
  token: string
  candidateName: string
  status: string
  createdAt: string
  completedAt: string | null
}

interface ResumeCardProps {
  positionId: string
  onInterviewCreated?: () => void
}

export function ResumeCard({ positionId, onInterviewCreated }: ResumeCardProps) {
  const [resumes, setResumes] = useState<Resume[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [previewResume, setPreviewResume] = useState<Resume | null>(null)
  const [notesResume, setNotesResume] = useState<Resume | null>(null)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [existingDialogOpen, setExistingDialogOpen] = useState(false)
  const [existingInterviews, setExistingInterviews] = useState<ExistingInterview[]>([])
  const [pendingResumeId, setPendingResumeId] = useState<string | null>(null)

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 5

  // 获取简历列表
  const fetchResumes = useCallback(async () => {
    try {
      const res = await fetch(`/api/positions/${positionId}/resumes`)
      const data = await res.json()
      setResumes(data || [])
    } catch (error) {
      console.error('获取简历列表失败:', error)
    } finally {
      setLoading(false)
    }
  }, [positionId])

  // 初始加载
  useEffect(() => {
    fetchResumes()
  }, [fetchResumes])

  // 切换选择
  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.size === resumes.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(resumes.map((r) => r.id)))
    }
  }

  // 批量删除
  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`确定删除选中的 ${selectedIds.size} 份简历吗？`)) return

    setDeleting(true)
    try {
      const res = await fetch('/api/resumes/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      })
      if (res.ok) {
        setSelectedIds(new Set())
        fetchResumes()
      }
    } catch (error) {
      console.error('批量删除失败:', error)
    } finally {
      setDeleting(false)
    }
  }

  // 检查已有面试并决定是否显示对话框
  const handleGenerateInterview = async (resumeId: string) => {
    setGeneratingId(resumeId)
    try {
      // 先检查是否有已存在的面试
      const checkRes = await fetch(`/api/resumes/${resumeId}/interviews`)
      const checkData = await checkRes.json()

      if (checkRes.ok && checkData.data?.length > 0) {
        // 有已存在的面试，显示对话框
        setExistingInterviews(checkData.data)
        setPendingResumeId(resumeId)
        setExistingDialogOpen(true)
        setGeneratingId(null)
        return
      }

      // 没有已存在的面试，直接创建
      await createNewInterview(resumeId)
    } catch (error) {
      console.error('检查面试链接失败:', error)
      setGeneratingId(null)
    }
  }

  // 创建新面试链接
  const createNewInterview = async (resumeId: string) => {
    setGeneratingId(resumeId)
    try {
      const res = await fetch(`/api/resumes/${resumeId}/interview`, {
        method: 'POST',
      })
      const data = await res.json()
      if (res.ok) {
        const link = `${window.location.origin}/interview-realtime/${data.data.token}`
        await navigator.clipboard.writeText(link)
        alert('面试链接已复制到剪贴板')
        onInterviewCreated?.()
        fetchResumes()
      }
    } catch (error) {
      console.error('生成面试链接失败:', error)
    } finally {
      setGeneratingId(null)
      setExistingDialogOpen(false)
      setPendingResumeId(null)
    }
  }

  // 复制已有面试链接
  const handleCopyExistingLink = async (token: string) => {
    const link = `${window.location.origin}/interview-realtime/${token}`
    await navigator.clipboard.writeText(link)
    alert('面试链接已复制到剪贴板')
    setExistingDialogOpen(false)
  }

  // 解析状态映射
  const parseStatusMap: Record<string, { label: string; color: string }> = {
    PENDING: { label: '待解析', color: 'bg-gray-100 text-gray-800' },
    PARSING: { label: '解析中', color: 'bg-blue-100 text-blue-800' },
    SUCCESS: { label: '已解析', color: 'bg-green-100 text-green-800' },
    FAILED: { label: '解析失败', color: 'bg-red-100 text-red-800' },
  }

  // 格式化文件大小
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">简历管理 ({resumes.length})</CardTitle>
          <div className="flex gap-2">
            {selectedIds.size > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBatchDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-1" />
                )}
                删除 ({selectedIds.size})
              </Button>
            )}
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4 mr-1" />
              上传简历
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : resumes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无简历，点击上方按钮上传
            </div>
          ) : (
            <div className="space-y-2">
              {/* 全选 */}
              <div className="flex items-center gap-2 pb-2 border-b">
                <Checkbox
                  checked={selectedIds.size === resumes.length}
                  onCheckedChange={toggleSelectAll}
                />
                <span className="text-sm text-muted-foreground">全选</span>
              </div>
              {/* 简历列表 */}
              {resumes
                .slice((currentPage - 1) * pageSize, currentPage * pageSize)
                .map((resume) => (
                  <ResumeItem
                    key={resume.id}
                    resume={resume}
                    selected={selectedIds.has(resume.id)}
                    onToggle={() => toggleSelect(resume.id)}
                    onPreview={() => setPreviewResume(resume)}
                    onNotes={() => setNotesResume(resume)}
                    onGenerate={() => handleGenerateInterview(resume.id)}
                    generating={generatingId === resume.id}
                    parseStatusMap={parseStatusMap}
                    formatSize={formatSize}
                  />
                ))}
              <SimplePagination
                currentPage={currentPage}
                totalPages={Math.ceil(resumes.length / pageSize)}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 上传弹窗 */}
      <ResumeUploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        positionId={positionId}
        onSuccess={fetchResumes}
      />

      {/* 预览弹窗 */}
      {previewResume && (
        <ResumePreviewDialog
          resume={previewResume}
          onClose={() => setPreviewResume(null)}
        />
      )}

      {/* 备注弹窗 */}
      {notesResume && (
        <ResumeNotesDialog
          resume={notesResume}
          onClose={() => setNotesResume(null)}
        />
      )}

      {/* 已有面试链接对话框 */}
      <ExistingInterviewsDialog
        open={existingDialogOpen}
        onOpenChange={setExistingDialogOpen}
        interviews={existingInterviews}
        onCreateNew={() => pendingResumeId && createNewInterview(pendingResumeId)}
        onCopyLink={handleCopyExistingLink}
        creating={generatingId !== null}
      />
    </>
  )
}

// 简历列表项组件
interface ResumeItemProps {
  resume: Resume
  selected: boolean
  onToggle: () => void
  onPreview: () => void
  onNotes: () => void
  onGenerate: () => void
  generating: boolean
  parseStatusMap: Record<string, { label: string; color: string }>
  formatSize: (bytes: number) => string
}

function ResumeItem({
  resume,
  selected,
  onToggle,
  onPreview,
  onNotes,
  onGenerate,
  generating,
  parseStatusMap,
  formatSize,
}: ResumeItemProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50">
      <Checkbox checked={selected} onCheckedChange={onToggle} />
      <FileText className="h-8 w-8 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">
            {resume.candidateName || resume.fileName}
          </span>
          <Badge
            className={parseStatusMap[resume.parseStatus]?.color}
            variant="secondary"
          >
            {parseStatusMap[resume.parseStatus]?.label}
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground flex gap-3">
          <span>{formatSize(resume.fileSize)}</span>
          {resume.phone && <span>{resume.phone}</span>}
          {resume.email && <span>{resume.email}</span>}
        </div>
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" onClick={onPreview} title="预览">
          <Eye className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onNotes} title="备注">
          <MessageSquare className="h-4 w-4" />
          {resume._count?.notes ? (
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center">
              {resume._count.notes}
            </span>
          ) : null}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onGenerate}
          disabled={generating}
          title="生成面试链接"
        >
          {generating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LinkIcon className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}
