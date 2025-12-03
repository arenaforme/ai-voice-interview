/**
 * 为已完成的面试重新生成评分和报告
 * 运行方式: npx tsx scripts/regenerate-reports.ts
 */
import { PrismaClient } from '@prisma/client'
import { evaluateAnswer, generateReport } from '../src/lib/ai/llm'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 查找需要重新生成报告的面试...')

  // 查找所有已完成但没有报告的面试
  const interviews = await prisma.interview.findMany({
    where: {
      status: 'COMPLETED',
      report: null
    },
    include: {
      position: true,
      rounds: {
        orderBy: { roundNumber: 'asc' }
      }
    }
  })

  console.log(`📋 找到 ${interviews.length} 个需要处理的面试\n`)

  for (let i = 0; i < interviews.length; i++) {
    const interview = interviews[i]
    console.log(`\n[${i + 1}/${interviews.length}] 处理面试: ${interview.candidateName} (${interview.position.name})`)

    try {
      // 1. 为每个回答重新评分
      console.log(`  📝 评估 ${interview.rounds.length} 个回答...`)
      for (const round of interview.rounds) {
        if (round.score === 0 || round.score === null) {
          const evaluation = await evaluateAnswer(
            interview.position.name,
            round.questionText,
            round.answerText || '',
            round.dimension
          )

          await prisma.interviewRound.update({
            where: { id: round.id },
            data: {
              score: evaluation.score,
              evaluation: evaluation.feedback
            }
          })

          console.log(`    ✓ 第${round.roundNumber}轮 [${round.dimension}]: ${evaluation.score}分`)
        }
      }

      // 2. 重新获取更新后的 rounds
      const updatedRounds = await prisma.interviewRound.findMany({
        where: { interviewId: interview.id },
        orderBy: { roundNumber: 'asc' }
      })

      // 3. 生成报告
      console.log(`  📊 生成面试报告...`)
      const reportData = await generateReport(
        interview.position.name,
        updatedRounds.map(r => ({
          dimension: r.dimension,
          questionText: r.questionText,
          answerText: r.answerText,
          score: r.score,
          evaluation: r.evaluation
        }))
      )

      // 4. 保存报告
      await prisma.interviewReport.create({
        data: {
          interviewId: interview.id,
          dimensionScores: reportData.dimensionScores,
          strengths: reportData.strengths,
          risks: reportData.risks,
          recommendation: reportData.recommendation,
          summary: reportData.summary
        }
      })

      console.log(`  ✅ 完成! 推荐: ${reportData.recommendation}`)

    } catch (error) {
      console.error(`  ❌ 处理失败:`, error)
    }
  }

  console.log('\n🎉 所有面试处理完成!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
