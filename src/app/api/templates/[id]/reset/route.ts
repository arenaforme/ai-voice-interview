import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'

interface RouteParams {
  params: Promise<{ id: string }>
}

// 默认问题模板
const defaultTemplates: Record<string, Array<{ dimension: string; sampleQuestions: string[] }>> = {
  '项目经理': [
    { dimension: '专业能力', sampleQuestions: ['先简单介绍一下自己吧，包括你的工作经历。', '能说说你最近负责的一个项目吗？', '这个项目中你遇到的最大挑战是什么？最后怎么解决的？'] },
    { dimension: '沟通表达', sampleQuestions: ['项目中遇到跨部门协作的问题，你一般怎么处理？', '团队成员对方案有不同意见时，你会怎么做？'] },
    { dimension: '逻辑思维', sampleQuestions: ['如果项目突然要提前上线，你会怎么调整计划？', '项目出了问题，你一般怎么定位原因？'] },
    { dimension: '执行力', sampleQuestions: ['有没有遇到过项目延期的情况？当时怎么处理的？', '资源不够的时候，你会怎么办？'] },
    { dimension: '职业动机', sampleQuestions: ['为什么想换工作？', '未来三年有什么职业规划？'] },
  ],
  '产品经理': [
    { dimension: '专业能力', sampleQuestions: ['先介绍一下自己吧。', '能说说你做过的最有成就感的产品吗？', '你是怎么做需求分析的？'] },
    { dimension: '沟通表达', sampleQuestions: ['开发说需求做不了，你一般怎么沟通？', '用户调研你一般怎么做？'] },
    { dimension: '逻辑思维', sampleQuestions: ['需求太多做不完，你怎么排优先级？', '数据下降了，你会怎么分析原因？'] },
    { dimension: '执行力', sampleQuestions: ['产品上线后效果不好，你会怎么办？', '版本延期了你会怎么处理？'] },
    { dimension: '职业动机', sampleQuestions: ['为什么想做产品经理？', '对我们公司的产品有什么了解？'] },
  ],
  '销售人员': [
    { dimension: '专业能力', sampleQuestions: ['先介绍一下你的销售经历吧。', '能说说你成交的最大一单吗？'] },
    { dimension: '沟通表达', sampleQuestions: ['客户说太贵了，你一般怎么回应？', '怎么快速和陌生客户建立信任？'] },
    { dimension: '逻辑思维', sampleQuestions: ['怎么判断一个客户值不值得跟进？', '丢单了你一般会怎么复盘？'] },
    { dimension: '执行力', sampleQuestions: ['月底还差业绩，你会怎么冲刺？', '客户一直拖着不签约，你怎么办？'] },
    { dimension: '职业动机', sampleQuestions: ['为什么选择做销售？', '你对收入有什么期望？'] },
  ],
}

// 重置为默认问题模板
export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: '未授权' }, { status: 401 })
  }

  const { id } = await params

  const template = await prisma.interviewTemplate.findUnique({
    where: { id },
  })

  if (!template) {
    return NextResponse.json({ error: '模板不存在' }, { status: 404 })
  }

  const defaultQuestions = defaultTemplates[template.name]
  if (!defaultQuestions) {
    return NextResponse.json({ error: '该模板没有默认问题配置' }, { status: 400 })
  }

  const updated = await prisma.interviewTemplate.update({
    where: { id },
    data: { questionTemplates: defaultQuestions },
  })

  return NextResponse.json({ data: updated })
}
