import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('开始初始化数据库...')

  // 创建默认 HR 用户
  const hashedPassword = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: '管理员',
      password: hashedPassword,
      role: 'ADMIN',
    },
  })
  console.log('创建管理员用户:', admin.email)

  // 创建面试模板
  const templates = [
    {
      name: '项目经理',
      description: '适用于项目经理岗位的面试模板',
      questionCount: 5,
      dimensions: ['专业能力', '沟通表达', '逻辑思维', '执行力', '职业动机'],
      systemPrompt: `你是一位专业的 AI 面试官，正在面试项目经理岗位的候选人。

评估重点：
1. 专业能力：项目管理方法论、工具使用、风险管理
2. 沟通表达：跨部门协调、向上汇报、团队沟通
3. 逻辑思维：问题分析、决策能力、优先级判断
4. 执行力：目标达成、进度把控、资源协调
5. 职业动机：职业规划、稳定性、学习意愿

请根据候选人的回答历史，生成有针对性的面试问题。`,
    },
    {
      name: '产品经理',
      description: '适用于产品经理岗位的面试模板',
      questionCount: 5,
      dimensions: ['专业能力', '沟通表达', '逻辑思维', '执行力', '职业动机'],
      systemPrompt: `你是一位专业的 AI 面试官，正在面试产品经理岗位的候选人。

评估重点：
1. 专业能力：需求分析、产品设计、数据分析
2. 沟通表达：用户调研、跨团队协作、产品演示
3. 逻辑思维：市场洞察、竞品分析、产品规划
4. 执行力：项目推进、版本迭代、目标达成
5. 职业动机：产品热情、行业理解、成长意愿

请根据候选人的回答历史，生成有针对性的面试问题。`,
    },
    {
      name: '销售人员',
      description: '适用于销售岗位的面试模板',
      questionCount: 5,
      dimensions: ['专业能力', '沟通表达', '逻辑思维', '执行力', '职业动机'],
      systemPrompt: `你是一位专业的 AI 面试官，正在面试销售岗位的候选人。

评估重点：
1. 专业能力：销售技巧、客户管理、行业知识
2. 沟通表达：客户沟通、谈判能力、演示技巧
3. 逻辑思维：客户需求分析、销售策略、问题解决
4. 执行力：目标达成、客户跟进、抗压能力
5. 职业动机：销售热情、收入期望、职业规划

请根据候选人的回答历史，生成有针对性的面试问题。`,
    },
  ]

  for (const tpl of templates) {
    const template = await prisma.interviewTemplate.upsert({
      where: { name: tpl.name },
      update: {},
      create: tpl,
    })
    console.log('创建面试模板:', template.name)
  }

  console.log('数据库初始化完成！')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
