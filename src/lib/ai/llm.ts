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
 * 生成面试问题
 */
export async function generateQuestion(
  positionName: string,
  systemPrompt: string,
  dimension: string,
  previousQA: Array<{ question: string; answer: string }>
): Promise<string> {
  let prompt = `岗位：${positionName}\n当前评估维度：${dimension}\n\n`

  if (previousQA.length > 0) {
    prompt += '历史问答：\n'
    previousQA.forEach((qa, i) => {
      prompt += `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}\n\n`
    })
  }

  prompt += '请生成一个针对该维度的面试问题。'

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
