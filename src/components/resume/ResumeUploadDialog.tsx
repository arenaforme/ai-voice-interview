'use client'

import { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Upload, X, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

interface ResumeUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  positionId: string
  onSuccess: () => void
}

interface UploadFile {
  file: File
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
}

const MAX_FILES = 20
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

export function ResumeUploadDialog({
  open,
  onOpenChange,
  positionId,
  onSuccess,
}: ResumeUploadDialogProps) {
  const [files, setFiles] = useState<UploadFile[]>([])
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // 处理文件选择
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    addFiles(selectedFiles)
    if (inputRef.current) inputRef.current.value = ''
  }

  // 添加文件到列表
  const addFiles = (newFiles: File[]) => {
    const validFiles: UploadFile[] = []
    for (const file of newFiles) {
      if (files.length + validFiles.length >= MAX_FILES) break
      if (!ALLOWED_TYPES.includes(file.type)) continue
      if (file.size > MAX_SIZE) continue
      if (files.some((f) => f.file.name === file.name)) continue
      validFiles.push({ file, status: 'pending' })
    }
    setFiles((prev) => [...prev, ...validFiles])
  }

  // 移除文件
  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  // 上传所有文件
  const handleUpload = async () => {
    if (files.length === 0) return
    setUploading(true)

    const formData = new FormData()
    files.forEach((f) => formData.append('files', f.file))

    try {
      const res = await fetch(`/api/positions/${positionId}/resumes`, {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (res.ok) {
        // 标记成功/失败的文件
        const successNames = new Set(
          data.resumes?.map((r: { fileName: string }) => r.fileName) || []
        )
        const errorMap = new Map(
          data.errors?.map((e: { fileName: string; error: string }) => [
            e.fileName,
            e.error,
          ]) || []
        )
        setFiles((prev) =>
          prev.map((f) => ({
            ...f,
            status: successNames.has(f.file.name)
              ? ('success' as const)
              : ('error' as const),
            error: errorMap.get(f.file.name),
          }))
        )
        setTimeout(() => {
          onSuccess()
          onOpenChange(false)
          setFiles([])
        }, 1000)
      } else {
        setFiles((prev) =>
          prev.map((f) => ({
            ...f,
            status: 'error' as const,
            error: data.error || '上传失败',
          }))
        )
      }
    } catch {
      setFiles((prev) =>
        prev.map((f) => ({ ...f, status: 'error' as const, error: '网络错误' }))
      )
    } finally {
      setUploading(false)
    }
  }

  // 拖拽处理
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const droppedFiles = Array.from(e.dataTransfer.files)
    addFiles(droppedFiles)
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const successCount = files.filter((f) => f.status === 'success').length
  const progress = files.length > 0 ? (successCount / files.length) * 100 : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>上传简历</DialogTitle>
        </DialogHeader>

        {/* 拖拽区域 */}
        <div
          className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">
            点击或拖拽文件到此处上传
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            支持 PDF、DOC、DOCX，单文件最大 10MB，最多 {MAX_FILES} 个
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>

        {/* 文件列表 */}
        {files.length > 0 && (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {files.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-2 p-2 rounded border"
              >
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{f.file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatSize(f.file.size)}
                  </p>
                </div>
                {f.status === 'pending' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeFile(i)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                {f.status === 'uploading' && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {f.status === 'success' && (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
                {f.status === 'error' && (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
            ))}
          </div>
        )}

        {/* 进度条 */}
        {uploading && <Progress value={progress} className="h-2" />}

        {/* 操作按钮 */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleUpload}
            disabled={files.length === 0 || uploading}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                上传中...
              </>
            ) : (
              `上传 (${files.length})`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
