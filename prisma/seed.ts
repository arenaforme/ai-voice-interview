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
      isSystem: true,
      isActive: true,
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
      isSystem: true,
      isActive: true,
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
      isSystem: true,
      isActive: true,
    },
    {
      name: 'Java程序员',
      description: '适用于Java技术开发岗位的面试模板',
      minQuestions: 5,
      maxQuestions: 10,
      dimensions: ['技术能力', '编码实践', '系统设计', '学习能力', '职业动机'],
      questionTemplates: [
        { dimension: '技术能力', sampleQuestions: ['先介绍一下你最熟悉的Java项目吧。', '这个项目用了哪些技术栈？', '项目中用到了哪些设计模式？', 'Spring框架你用得多吗？主要用哪些模块？'] },
        { dimension: '编码实践', sampleQuestions: ['你们团队是怎么做代码review的？', '单元测试你一般怎么写？覆盖率要求多少？', '遇到过线上bug吗？怎么排查的？'] },
        { dimension: '系统设计', sampleQuestions: ['遇到过性能问题吗？怎么排查和优化的？', '高并发场景你一般怎么处理？', '数据库优化你有什么经验？'] },
        { dimension: '学习能力', sampleQuestions: ['最近在学什么新技术？为什么想学？', '平时怎么提升自己的技术能力？', '有关注什么技术社区或博客吗？'] },
        { dimension: '职业动机', sampleQuestions: ['为什么想换工作？', '期望的技术方向是什么？', '对加班怎么看？'] },
      ],
      systemPrompt: interviewerPrompt,
      isSystem: true,
      isActive: true,
    },
    {
      name: '教育信息化产品经理',
      description: '适用于教育行业产品经理岗位的面试模板',
      minQuestions: 5,
      maxQuestions: 10,
      dimensions: ['行业理解', '产品能力', '用户洞察', '项目推进', '职业动机'],
      questionTemplates: [
        { dimension: '行业理解', sampleQuestions: ['你对教育信息化行业有什么了解？', '目前教育信息化的主要痛点是什么？', '你觉得AI对教育行业会有什么影响？'] },
        { dimension: '产品能力', sampleQuestions: ['做过的教育类产品有哪些？核心功能是什么？', '怎么衡量一个教育产品的成功？', '能说说你主导的一个产品迭代吗？'] },
        { dimension: '用户洞察', sampleQuestions: ['教育产品的用户群体有什么特点？', '老师和学生的需求有什么不同？', '你是怎么做用户调研的？'] },
        { dimension: '项目推进', sampleQuestions: ['教育产品的实施周期一般多长？', '遇到过什么困难？怎么解决的？', '怎么协调学校、老师、家长的不同诉求？'] },
        { dimension: '职业动机', sampleQuestions: ['为什么选择教育行业？', '对教育信息化的未来怎么看？', '你的职业规划是什么？'] },
      ],
      systemPrompt: interviewerPrompt,
      isSystem: true,
      isActive: true,
    },
    {
      name: '售后服务',
      description: '适用于客户服务岗位的面试模板',
      minQuestions: 5,
      maxQuestions: 10,
      dimensions: ['服务意识', '问题处理', '沟通技巧', '抗压能力', '职业动机'],
      questionTemplates: [
        { dimension: '服务意识', sampleQuestions: ['你觉得好的售后服务应该是什么样的？', '怎么理解"客户至上"这个理念？', '有没有让你印象深刻的服务体验？'] },
        { dimension: '问题处理', sampleQuestions: ['遇到过最棘手的客户投诉是什么？怎么解决的？', '客户的问题你解决不了怎么办？', '怎么判断问题的优先级？'] },
        { dimension: '沟通技巧', sampleQuestions: ['客户情绪激动时，你一般怎么安抚？', '怎么向客户解释技术问题？', '遇到不讲理的客户怎么办？'] },
        { dimension: '抗压能力', sampleQuestions: ['工作中压力最大的时候是什么情况？', '同时处理多个客户问题，你怎么安排？', '被客户投诉过吗？当时什么感受？'] },
        { dimension: '职业动机', sampleQuestions: ['为什么选择售后服务这个岗位？', '你觉得这个岗位最重要的能力是什么？', '未来想往什么方向发展？'] },
      ],
      systemPrompt: interviewerPrompt,
      isSystem: true,
      isActive: true,
    },
    {
      name: '人力资源',
      description: '适用于HR岗位的面试模板',
      minQuestions: 5,
      maxQuestions: 10,
      dimensions: ['专业知识', '招聘能力', '员工关系', '数据分析', '职业动机'],
      questionTemplates: [
        { dimension: '专业知识', sampleQuestions: ['你最熟悉的HR模块是哪个？', '劳动法相关的知识了解多少？', '绩效考核你们公司是怎么做的？'] },
        { dimension: '招聘能力', sampleQuestions: ['招聘渠道你一般怎么选择？效果怎么评估？', '怎么判断一个候选人是否合适？', '遇到过招聘难的岗位吗？怎么解决的？'] },
        { dimension: '员工关系', sampleQuestions: ['处理过员工纠纷吗？怎么处理的？', '员工离职面谈你一般怎么做？', '怎么提升员工满意度？'] },
        { dimension: '数据分析', sampleQuestions: ['你们公司的离职率是多少？主要原因是什么？', '招聘数据你一般关注哪些指标？', '怎么用数据支持HR决策？'] },
        { dimension: '职业动机', sampleQuestions: ['HR工作中你最有成就感的事是什么？', '为什么想换工作？', '对HRBP这个方向怎么看？'] },
      ],
      systemPrompt: interviewerPrompt,
      isSystem: true,
      isActive: true,
    },
    {
      name: '总经理助理',
      description: '适用于行政管理岗位的面试模板',
      minQuestions: 5,
      maxQuestions: 10,
      dimensions: ['综合能力', '协调沟通', '文书写作', '保密意识', '职业动机'],
      questionTemplates: [
        { dimension: '综合能力', sampleQuestions: ['日常工作主要负责哪些事务？', '怎么安排领导的日程？', '出差行程你一般怎么规划？'] },
        { dimension: '协调沟通', sampleQuestions: ['怎么协调多个部门的会议安排？', '领导交代的事情和部门的事情冲突了怎么办？', '怎么和不同层级的人沟通？'] },
        { dimension: '文书写作', sampleQuestions: ['写过什么类型的公文或报告？', '会议纪要你一般怎么写？', '领导讲话稿你写过吗？'] },
        { dimension: '保密意识', sampleQuestions: ['工作中接触过敏感信息吗？怎么处理的？', '有人打听公司内部信息怎么办？', '怎么理解职业操守？'] },
        { dimension: '职业动机', sampleQuestions: ['你觉得这个岗位最重要的能力是什么？', '为什么想做总助这个岗位？', '未来的职业规划是什么？'] },
      ],
      systemPrompt: interviewerPrompt,
      isSystem: true,
      isActive: true,
    },
    {
      name: 'AI应用实习生',
      description: '适用于AI方向实习生岗位的面试模板',
      minQuestions: 5,
      maxQuestions: 10,
      dimensions: ['基础知识', '学习能力', '实践经验', '团队协作', '职业规划'],
      questionTemplates: [
        { dimension: '基础知识', sampleQuestions: ['了解哪些AI相关的技术或工具？', '用过ChatGPT或其他AI产品吗？体验怎么样？', '对大语言模型有什么了解？'] },
        { dimension: '学习能力', sampleQuestions: ['平时怎么学习AI相关知识的？', '遇到不懂的问题一般怎么解决？', '最近学到的最有意思的东西是什么？'] },
        { dimension: '实践经验', sampleQuestions: ['做过AI相关的项目或作业吗？', '用AI工具做过什么有意思的事情？', '有没有自己训练过模型？'] },
        { dimension: '团队协作', sampleQuestions: ['在学校参加过什么团队项目？', '团队合作中你一般担任什么角色？', '遇到过团队意见不一致的情况吗？怎么处理的？'] },
        { dimension: '职业规划', sampleQuestions: ['实习期望学到什么？', '未来想往哪个方向发展？', '为什么对AI感兴趣？'] },
      ],
      systemPrompt: interviewerPrompt,
      isSystem: true,
      isActive: true,
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
