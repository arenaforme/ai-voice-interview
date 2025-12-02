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

  // 默认问题模板数据
  const pmQuestionTemplates = [
    { dimension: '专业能力', sampleQuestions: ['先简单介绍一下自己吧，包括你的工作经历。', '能说说你最近负责的一个项目吗？', '这个项目中你遇到的最大挑战是什么？最后怎么解决的？', '你们项目的进度是怎么管控的？'] },
    { dimension: '沟通表达', sampleQuestions: ['项目中遇到跨部门协作的问题，你一般怎么处理？', '能举个例子说说你是怎么向上级汇报项目进展的？', '团队成员对方案有不同意见时，你会怎么做？'] },
    { dimension: '逻辑思维', sampleQuestions: ['如果项目突然要提前上线，你会怎么调整计划？', '怎么判断一个需求该不该做？', '项目出了问题，你一般怎么定位原因？'] },
    { dimension: '执行力', sampleQuestions: ['有没有遇到过项目延期的情况？当时怎么处理的？', '你是怎么确保团队按时交付的？', '资源不够的时候，你会怎么办？'] },
    { dimension: '职业动机', sampleQuestions: ['为什么想换工作？', '你对下一份工作有什么期望？', '未来三年有什么职业规划？'] },
  ]

  // 通用的面试官 System Prompt
  const interviewerPrompt = `你是一位经验丰富的面试官，正在进行一场真实的面试对话。

## 核心原则
1. 自然对话：像真人面试官一样提问，语气亲切专业
2. 禁止元信息：绝对不要提及"评估维度"、"面试问题"、"考察点"等词汇
3. 追问深入：根据候选人回答自然追问，而非机械切换话题
4. 简洁明了：问题简短有力，一次只问一个问题

## 输出要求
直接输出问题，不要有任何前缀、后缀或解释。`

  // 创建面试模板
  const templates = [
    {
      name: '项目经理',
      description: '适用于项目经理岗位的面试模板',
      minQuestions: 5,
      maxQuestions: 10,
      dimensions: ['专业能力', '沟通表达', '逻辑思维', '执行力', '职业动机'],
      questionTemplates: pmQuestionTemplates,
      systemPrompt: interviewerPrompt,
    },
    {
      name: '产品经理',
      description: '适用于产品经理岗位的面试模板',
      minQuestions: 5,
      maxQuestions: 10,
      dimensions: ['专业能力', '沟通表达', '逻辑思维', '执行力', '职业动机'],
      questionTemplates: [
        { dimension: '专业能力', sampleQuestions: ['先介绍一下自己吧。', '能说说你做过的最有成就感的产品吗？', '这个产品的核心指标是什么？效果怎么样？', '你是怎么做需求分析的？'] },
        { dimension: '沟通表达', sampleQuestions: ['开发说需求做不了，你一般怎么沟通？', '怎么向老板汇报产品规划？', '用户调研你一般怎么做？'] },
        { dimension: '逻辑思维', sampleQuestions: ['需求太多做不完，你怎么排优先级？', '竞品分析你一般关注哪些方面？', '数据下降了，你会怎么分析原因？'] },
        { dimension: '执行力', sampleQuestions: ['产品上线后效果不好，你会怎么办？', '怎么推动一个大家都不想做的需求？', '版本延期了你会怎么处理？'] },
        { dimension: '职业动机', sampleQuestions: ['为什么想做产品经理？', '你觉得好的产品经理应该具备什么能力？', '对我们公司的产品有什么了解？'] },
      ],
      systemPrompt: interviewerPrompt,
    },
    {
      name: '销售人员',
      description: '适用于销售岗位的面试模板',
      minQuestions: 5,
      maxQuestions: 10,
      dimensions: ['专业能力', '沟通表达', '逻辑思维', '执行力', '职业动机'],
      questionTemplates: [
        { dimension: '专业能力', sampleQuestions: ['先介绍一下你的销售经历吧。', '你之前主要卖什么产品？客单价大概多少？', '能说说你成交的最大一单吗？', '你的销售业绩在团队里排什么水平？'] },
        { dimension: '沟通表达', sampleQuestions: ['客户说太贵了，你一般怎么回应？', '怎么快速和陌生客户建立信任？', '客户犹豫不决的时候，你会怎么推进？'] },
        { dimension: '逻辑思维', sampleQuestions: ['怎么判断一个客户值不值得跟进？', '你是怎么规划自己的客户拜访的？', '丢单了你一般会怎么复盘？'] },
        { dimension: '执行力', sampleQuestions: ['月底还差业绩，你会怎么冲刺？', '客户一直拖着不签约，你怎么办？', '有没有遇到过特别难搞的客户？怎么处理的？'] },
        { dimension: '职业动机', sampleQuestions: ['为什么选择做销售？', '你对收入有什么期望？', '能接受出差吗？频率大概多少？'] },
      ],
      systemPrompt: interviewerPrompt,
    },
  ]

  for (const tpl of templates) {
    const template = await prisma.interviewTemplate.upsert({
      where: { name: tpl.name },
      update: {
        minQuestions: tpl.minQuestions,
        maxQuestions: tpl.maxQuestions,
        questionTemplates: tpl.questionTemplates,
        systemPrompt: tpl.systemPrompt,
      },
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
