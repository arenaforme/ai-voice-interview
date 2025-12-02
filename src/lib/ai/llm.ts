import anthropic from './anthropic'
import {
  INTERVIEWER_SYSTEM_PROMPT,
  EVALUATOR_SYSTEM_PROMPT,
  REPORT_SYSTEM_PROMPT,
} from './prompts/interviewer'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'

export interface EvaluationResult {
  score: number
  feedback: string
}

export interface ReportData {
  dimensionScores: Record<string, number>
  strengths: string[]
  risks: string[]
  recommendation: 'RECOMMENDED' | 'CAUTIOUS' | 'NOT_RECOMMENDED'
  summary: string
}

/**
 * 问题模板类型
 */
export interface QuestionTemplateItem {
  dimension: string
  sampleQuestions: string[]
}

/**
 * 面试上下文信息
 */
export interface InterviewContext {
  positionName: string
  systemPrompt: string
  allDimensions: string[]
  coveredDimensions: string[]
  currentRound: number
  minRounds: number
  maxRounds: number
  previousQA: Array<{ question: string; answer: string; dimension: string }>
  questionTemplates?: QuestionTemplateItem[]
}

/**
 * AI 生成问题的结果
 */
export interface GenerateQuestionResult {
  question: string
  dimension: string
  shouldEnd: boolean
}

/**
 * 智能生成面试问题（AI 自主选择维度）
 */
export async function generateQuestionSmart(
  context: InterviewContext
): Promise<GenerateQuestionResult> {
  const {
    positionName,
    systemPrompt,
    allDimensions,
    coveredDimensions,
    currentRound,
    minRounds,
    maxRounds,
    previousQA,
    questionTemplates,
  } = context

  const uncoveredDimensions = allDimensions.filter(
    (d) => !coveredDimensions.includes(d)
  )
  const remainingQuestions = maxRounds - currentRound
  const hasReachedMin = currentRound >= minRounds
  const allDimensionsCovered = uncoveredDimensions.length === 0

  // 构建 prompt
  let prompt = `你正在面试一位应聘「${positionName}」岗位的候选人。\n\n`

  // 面试进度信息
  prompt += `【面试进度】\n`
  prompt += `- 当前第 ${currentRound + 1} 题（最少 ${minRounds} 题，最多 ${maxRounds} 题）\n`
  prompt += `- 已覆盖维度：${coveredDimensions.length > 0 ? coveredDimensions.join('、') : '无'}\n`
  prompt += `- 未覆盖维度：${uncoveredDimensions.length > 0 ? uncoveredDimensions.join('、') : '全部已覆盖'}\n`
  prompt += `- 剩余问题配额：${remainingQuestions} 题\n\n`

  // 维度选择指导
  if (uncoveredDimensions.length > 0 && uncoveredDimensions.length >= remainingQuestions) {
    prompt += `【重要】剩余配额紧张，请优先选择未覆盖的维度：${uncoveredDimensions.join('、')}\n\n`
  }

  // 注入问题模板参考
  if (questionTemplates && questionTemplates.length > 0) {
    prompt += '【各维度参考问题风格】（不要照搬，根据对话自然提问）\n'
    questionTemplates.forEach((t) => {
      const status = coveredDimensions.includes(t.dimension) ? '✓已覆盖' : '○未覆盖'
      prompt += `${t.dimension} [${status}]：\n`
      t.sampleQuestions.slice(0, 2).forEach((q) => {
        prompt += `  - ${q}\n`
      })
    })
    prompt += '\n'
  }

  // 对话历史
  if (previousQA.length > 0) {
    prompt += '【对话历史】\n'
    previousQA.forEach((qa) => {
      prompt += `你：${qa.question}\n候选人：${qa.answer}\n\n`
    })
  }

  // 任务指令
  if (previousQA.length === 0) {
    prompt += '这是面试开始，请自然地开场并提出第一个问题。\n'
  } else {
    prompt += '请根据候选人的回答，决定是继续追问当前话题还是切换到新的维度。\n'
  }

  prompt += `
【输出格式要求】
请严格按以下 JSON 格式输出，不要输出任何其他内容：
{
  "dimension": "你选择的评估维度（从上述维度中选择一个）",
  "question": "你要问候选人的问题（只写问题本身，不要有任何前缀、解释或评价）"
}

【重要提醒】
- question 字段会直接播放给候选人听，所以只能包含面试问题本身
- 绝对不要在 question 中提及"维度"、"切换"、"评估"、"考察"等词汇
- 绝对不要在 question 中评价候选人之前的回答
- 问题要自然、简洁，像真人面试官一样提问`

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: systemPrompt || INTERVIEWER_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type')
  }

  // 解析 JSON 响应
  const jsonMatch = content.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    // 降级处理：使用原始文本作为问题
    const fallbackDimension = uncoveredDimensions[0] || allDimensions[0]
    return {
      question: content.text.trim(),
      dimension: fallbackDimension,
      shouldEnd: false,
    }
  }

  try {
    const result = JSON.parse(jsonMatch[0])
    const dimension = result.dimension || uncoveredDimensions[0] || allDimensions[0]
    const question = result.question || content.text.trim()

    // 判断是否应该结束
    const newCoveredDimensions = coveredDimensions.includes(dimension)
      ? coveredDimensions
      : [...coveredDimensions, dimension]
    const willAllBeCovered = newCoveredDimensions.length >= allDimensions.length
    const nextRound = currentRound + 1

    // 结束条件：达到最大问题数，或者（达到最小问题数且所有维度已覆盖）
    const shouldEnd =
      nextRound >= maxRounds || (nextRound >= minRounds && willAllBeCovered)

    return { question, dimension, shouldEnd }
  } catch {
    const fallbackDimension = uncoveredDimensions[0] || allDimensions[0]
    return {
      question: content.text.trim(),
      dimension: fallbackDimension,
      shouldEnd: false,
    }
  }
}

/**
 * 生成面试问题（兼容旧接口）
 */
export async function generateQuestion(
  positionName: string,
  systemPrompt: string,
  dimension: string,
  previousQA: Array<{ question: string; answer: string }>,
  questionTemplates?: QuestionTemplateItem[]
): Promise<string> {
  let prompt = `你正在面试一位应聘「${positionName}」岗位的候选人。\n\n`

  // 注入当前维度的示例问题作为参考
  const currentDimensionTemplate = questionTemplates?.find(
    (t) => t.dimension === dimension
  )
  if (currentDimensionTemplate?.sampleQuestions?.length) {
    prompt += '参考问题风格（不要照搬，根据对话自然提问）：\n'
    currentDimensionTemplate.sampleQuestions.forEach((q) => {
      prompt += `- ${q}\n`
    })
    prompt += '\n'
  }

  if (previousQA.length > 0) {
    prompt += '对话历史：\n'
    previousQA.forEach((qa) => {
      prompt += `你：${qa.question}\n候选人：${qa.answer}\n\n`
    })
  }

  if (previousQA.length === 0) {
    prompt += '这是面试开始，请自然地开场并提出第一个问题。'
  } else {
    prompt += '请根据候选人的回答，自然地继续对话或追问。'
  }

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: systemPrompt || INTERVIEWER_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type')
  }

  return content.text.trim()
}

/**
 * 评估候选人回答
 */
export async function evaluateAnswer(
  positionName: string,
  question: string,
  answer: string,
  dimension: string
): Promise<EvaluationResult> {
  const prompt = `岗位：${positionName}
评估维度：${dimension}

问题：${question}
回答：${answer}

请评估此回答并给出评分（0-5分）和简短评价。
格式：
评分：X分
评价：...`

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: EVALUATOR_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type')
  }

  const text = content.text
  const scoreMatch = text.match(/(\d+(?:\.\d+)?)\s*分/)
  const score = scoreMatch ? parseFloat(scoreMatch[1]) : 3

  return {
    score: Math.min(5, Math.max(0, score)),
    feedback: text.replace(/评分[：:]\s*\d+(?:\.\d+)?\s*分\s*/, '').trim(),
  }
}

/**
 * 生成面试报告
 */
export async function generateReport(
  positionName: string,
  rounds: Array<{
    dimension: string
    questionText: string
    answerText: string | null
    score: number | null
    evaluation: string | null
  }>
): Promise<ReportData> {
  let prompt = `岗位：${positionName}\n\n面试记录：\n`

  rounds.forEach((round, i) => {
    prompt += `\n第${i + 1}轮 [${round.dimension}]\n`
    prompt += `问题：${round.questionText}\n`
    prompt += `回答：${round.answerText || '未回答'}\n`
    prompt += `评分：${round.score ?? 0}分\n`
    prompt += `评价：${round.evaluation || '无'}\n`
  })

  prompt += `\n请生成面试报告，输出 JSON 格式：
{
  "dimensionScores": {"维度名": 分数, ...},
  "strengths": ["优势1", "优势2"],
  "risks": ["风险1", "风险2"],
  "recommendation": "RECOMMENDED" | "CAUTIOUS" | "NOT_RECOMMENDED",
  "summary": "总结评语"
}`

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: REPORT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const content = response.content[0]
  if (content.type !== 'text') {
    throw new Error('Unexpected response type')
  }

  // 提取 JSON
  const jsonMatch = content.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    // 返回默认报告
    return {
      dimensionScores: {},
      strengths: ['待评估'],
      risks: ['待评估'],
      recommendation: 'CAUTIOUS',
      summary: content.text.slice(0, 200),
    }
  }

  try {
    return JSON.parse(jsonMatch[0]) as ReportData
  } catch {
    return {
      dimensionScores: {},
      strengths: ['待评估'],
      risks: ['待评估'],
      recommendation: 'CAUTIOUS',
      summary: content.text.slice(0, 200),
    }
  }
}
