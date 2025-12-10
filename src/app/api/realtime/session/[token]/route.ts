import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db/prisma'

/**
 * 获取面试会话配置（用于 Realtime API）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    const interview = await prisma.interview.findUnique({
      where: { token },
      include: {
        position: {
          include: {
            template: true,
          },
        },
      },
    })

    if (!interview) {
      return NextResponse.json({ error: '面试不存在' }, { status: 404 })
    }

    if (interview.status === 'COMPLETED') {
      return NextResponse.json({ error: '面试已结束' }, { status: 400 })
    }

    const { position, candidateName, minRounds, maxRounds } = interview
    const { template } = position

    // 构建评估维度列表
    const dimensions = template.dimensions as Array<{
      name: string
      weight: number
      description: string
    }>
    const dimensionNames = dimensions.map((d) => d.name)

    // 构建系统提示词
    const systemPrompt = buildSystemPrompt({
      positionName: position.name,
      candidateName,
      dimensions: dimensionNames,
      minRounds,
      maxRounds,
      openingMessage: '您好，欢迎参加本次面试。我是您的AI面试官，接下来我会问您几个问题，请放松心态，自然回答即可。',
      closingMessage: '好的，本次面试到此结束。感谢您的参与，我们会尽快将结果通知您。祝您一切顺利！',
    })

    return NextResponse.json({
      interviewId: interview.id,
      candidateName,
      positionName: position.name,
      minRounds,
      maxRounds,
      dimensions: dimensionNames,
      systemPrompt,
      voice: 'alloy',
    })
  } catch (error) {
    console.error('获取面试配置失败:', error)
    return NextResponse.json({ error: '获取配置失败' }, { status: 500 })
  }
}

interface PromptParams {
  positionName: string
  candidateName: string
  dimensions: string[]
  minRounds: number
  maxRounds: number
  openingMessage?: string | null
  closingMessage?: string | null
}

function buildSystemPrompt(params: PromptParams): string {
  const {
    positionName,
    candidateName,
    dimensions,
    minRounds,
    maxRounds,
    openingMessage,
    closingMessage,
  } = params

  // 构建维度列表，带编号
  const dimensionList = dimensions
    .map((d, i) => `${i + 1}. ${d}`)
    .join('\n')

  // 确保最小问题数至少等于维度数量
  const effectiveMinRounds = Math.max(minRounds, dimensions.length)

  return `你是一位专业的 HR 面试官，正在对「${positionName}」岗位的候选人 ${candidateName} 进行初筛面试。

【核心任务 - 必须完成】
你必须对以下 ${dimensions.length} 个维度进行全面评估，每个维度至少提问 1 个问题并记录评分：
${dimensionList}

【强制要求】
- 面试过程中必须覆盖上述所有 ${dimensions.length} 个维度
- 每个维度至少提问 1 个问题
- 每个问题回答后必须调用 record_evaluation 记录该维度的评分
- 只有当所有维度都已评估后，才能结束面试

【面试流程】
1. 开场问候：${openingMessage || '简短介绍自己和面试流程（约30秒）'}
2. 按顺序依次考察上述每个维度，确保所有维度都被覆盖
3. 每个维度提问 1-2 个问题，根据回答质量决定是否追问
4. 完成至少 ${effectiveMinRounds} 个问题（覆盖所有维度）后，最多 ${maxRounds} 个问题，礼貌结束面试
5. 结束语：${closingMessage || '感谢候选人参与，告知后续流程'}

【提问规则】
- 每次只问一个问题，等待候选人回答
- 问题简洁明了，避免复合问题
- 根据回答自然过渡，可以追问细节
- 候选人回答不清楚时，可以换个角度再问
- 确保在面试结束前，每个维度都至少提问过一次

【评估要求 - 非常重要】
- 每个问题回答后，必须调用 record_evaluation 函数记录评分
- dimension 参数必须精确使用以下中文维度名称之一：${dimensions.map((d) => `"${d}"`).join('、')}
- 禁止使用英文维度名（如 communication、experience 等），必须使用上述中文名称
- 评分标准：0-1分(差) 2分(一般) 3分(合格) 4分(良好) 5分(优秀)
- summary 参数必须使用中文描述候选人的回答要点
- 只有当所有 ${dimensions.length} 个维度都已评估后，才能调用 end_interview 函数结束面试
- 结束面试前，请确认已为每个维度记录了评分

【语气风格】
- 专业但友好，让候选人感到放松
- 适当给予简短反馈，如"好的"、"明白了"
- 避免评价性语言，如"回答得很好"或"这个回答不太理想"
- 使用中文进行面试`
}
