import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { generateReport } from '@/lib/ai/llm'

interface EvaluationData {
  dimension: string
  question: string
  answer: string
  score: number
  analysis: string
}

interface CompleteRequest {
  evaluations: EvaluationData[]
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body: CompleteRequest = await request.json()
    const { evaluations } = body

    // 查找面试记录
    const interview = await prisma.interview.findUnique({
      where: { token },
      include: {
        position: { include: { template: true } },
      },
    })

    if (!interview) {
      return NextResponse.json({ error: '面试不存在' }, { status: 404 })
    }

    // 幂等处理：如果面试已完成，返回成功（避免重复调用报错）
    if (interview.status === 'COMPLETED') {
      return NextResponse.json({ success: true, message: '面试已完成' })
    }

    // 验证是否有有效的面试内容
    if (!evaluations || evaluations.length === 0) {
      return NextResponse.json(
        { error: '面试内容为空，无法生成报告' },
        { status: 400 }
      )
    }

    // 计算平均分
    const totalScore = evaluations.reduce((sum, e) => sum + e.score, 0)
    const avgScore = evaluations.length > 0 ? totalScore / evaluations.length : 0

    // 生成面试报告 - 转换为 generateReport 需要的格式
    const rounds = evaluations.map((e) => ({
      dimension: e.dimension,
      questionText: e.question || `关于${e.dimension}的问题`,
      answerText: e.answer || '',
      score: e.score,
      evaluation: e.analysis || '',
    }))

    // 提取模板维度，确保报告维度与模板一致
    const templateDimensions = (
      interview.position.template.dimensions as Array<{ name: string }>
    ).map((d) => d.name)

    const reportData = await generateReport(
      interview.position.name,
      rounds,
      templateDimensions
    )

    // 更新面试记录并创建报告
    await prisma.interview.update({
      where: { id: interview.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        report: {
          create: {
            qaRecords: JSON.parse(JSON.stringify(reportData.qaRecords)),
            dimensionScores: reportData.dimensionScores,
            strengths: reportData.strengths,
            risks: reportData.risks,
            recommendation: reportData.recommendation,
            summary: reportData.summary,
          },
        },
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Complete interview error:', error)
    return NextResponse.json(
      { error: '保存面试结果失败' },
      { status: 500 }
    )
  }
}
