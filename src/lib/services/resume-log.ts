import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'

export type ResumeAction =
  | 'UPLOAD'
  | 'DELETE'
  | 'BATCH_DELETE'
  | 'ADD_NOTE'
  | 'DELETE_NOTE'
  | 'EDIT_INFO'
  | 'GENERATE_INTERVIEW'
  | 'REPARSE'

/**
 * 记录简历操作日志
 */
export async function logResumeAction(
  action: ResumeAction,
  operatorId: string,
  resumeId?: string | null,
  details?: Prisma.InputJsonValue
): Promise<void> {
  await prisma.resumeLog.create({
    data: {
      action,
      operatorId,
      resumeId: resumeId || null,
      details: details ?? Prisma.JsonNull,
    },
  })
}

/**
 * 获取简历操作日志
 */
export async function getResumeLogs(resumeId: string) {
  return prisma.resumeLog.findMany({
    where: { resumeId },
    include: {
      operator: {
        select: { id: true, name: true, email: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}
