'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Trash2, Send } from 'lucide-react'
import type { Resume, ResumeNote } from '@/types'

interface ResumeNotesDialogProps {
  resume: Resume
  onClose: () => void
}

export function ResumeNotesDialog({ resume, onClose }: ResumeNotesDialogProps) {
  const [notes, setNotes] = useState<ResumeNote[]>([])
  const [loading, setLoading] = useState(true)
  const [newNote, setNewNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    fetchNotes()
  }, [resume.id])

  const fetchNotes = async () => {
    try {
      const res = await fetch(`/api/resumes/${resume.id}/notes`)
      const data = await res.json()
      setNotes(data || [])
    } catch (error) {
      console.error('获取备注失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!newNote.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/resumes/${resume.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: newNote.trim() }),
      })
      if (res.ok) {
        setNewNote('')
        fetchNotes()
      }
    } catch (error) {
      console.error('添加备注失败:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (noteId: string) => {
    if (!confirm('确定删除这条备注吗？')) return
    setDeletingId(noteId)
    try {
      const res = await fetch(`/api/resumes/${resume.id}/notes/${noteId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        fetchNotes()
      }
    } catch (error) {
      console.error('删除备注失败:', error)
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            备注 - {resume.candidateName || resume.fileName}
          </DialogTitle>
        </DialogHeader>

        {/* 备注列表 */}
        <div className="space-y-3 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无备注
            </div>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className="p-3 rounded-lg border bg-muted/30 group"
              >
                <div className="flex justify-between items-start gap-2">
                  <p className="text-sm whitespace-pre-wrap flex-1">
                    {note.content}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDelete(note.id)}
                    disabled={deletingId === note.id}
                  >
                    {deletingId === note.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
                  <span>{note.createdBy?.name || '未知用户'}</span>
                  <span>{formatDate(note.createdAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 添加备注 */}
        <div className="flex gap-2">
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="输入备注内容..."
            className="min-h-[80px] resize-none"
          />
        </div>
        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={!newNote.trim() || submitting}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Send className="h-4 w-4 mr-1" />
            )}
            添加备注
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
