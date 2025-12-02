import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

interface RouteParams {
  params: Promise<{ token: string }>
}

// 获取面试状态（候选人端）
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { token } = await params

  const interview = await prisma.interview.findUnique({
    where: { token },
    include: {
      position: { include: { template: true } },
      rounds: { orderBy: { roundNumber: 'desc' }, take: 1 },
    },
  })

  if (!interview) {
    return NextResponse.json({ error: '面试链接无效' }, { status: 404 })
  }

  // 检查面试是否已完成
  if (interview.status === 'COMPLETED') {
    return NextResponse.json({
      data: {
        status: 'COMPLETED',
        positionName: interview.position.name,
        candidateName: interview.candidateName,
      },
    })
  }

  // 获取当前问题
  const lastRound = interview.rounds[0]
  const currentRound = lastRound ? lastRound.roundNumber : 0

  return NextResponse.json({
    data: {
      token: interview.token,
      positionName: interview.position.name,
      candidateName: interview.candidateName,
      status: interview.status,
      currentRound,
      maxRounds: interview.maxRounds,
      currentQuestion: lastRound
        ? {
            roundNumber: lastRound.roundNumber,
            questionText: lastRound.questionText,
            questionAudioUrl: lastRound.questionAudioUrl,
            dimension: lastRound.dimension,
          }
        : null,
    },
  })
}
