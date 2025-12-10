'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Mic,
  Brain,
  FileText,
  Clock,
  Shield,
  Smartphone,
  ArrowRight,
  Play,
  X,
  MessageSquare,
  BarChart3,
  CheckCircle2
} from 'lucide-react'

export default function HomePage() {
  const [showDemo, setShowDemo] = useState(false)
  return (
    <div className="min-h-screen bg-white">
      {/* 导航栏 */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-neutral-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center">
                <Mic className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-semibold text-neutral-900">AI 面试官</span>
            </div>
            <Link href="/login">
              <Button variant="ghost" className="text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100">
                HR 登录
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero 区域 */}
      <section className="pt-32 pb-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* 主标题 */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-semibold text-neutral-900 tracking-tight leading-[1.1] mb-6">
            智能面试
            <br />
            <span className="text-neutral-400">重新定义</span>
          </h1>

          {/* 副标题 */}
          <p className="text-xl text-neutral-500 mb-10 max-w-2xl mx-auto leading-relaxed font-light">
            AI 驱动的语音面试系统，让 HR 初筛更高效。
            <br />
            自动提问、实时评估、智能报告。
          </p>

          {/* CTA 按钮 */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/login">
              <Button size="lg" className="bg-neutral-900 hover:bg-neutral-800 text-white px-8 h-12 text-base rounded-full">
                开始使用
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Button
              size="lg"
              variant="ghost"
              className="text-neutral-600 hover:text-neutral-900 px-8 h-12 text-base rounded-full"
              onClick={() => setShowDemo(true)}
            >
              <Play className="mr-2 w-4 h-4" />
              观看演示
            </Button>
          </div>
        </div>
      </section>

      {/* 数据展示 */}
      <section className="py-16 px-6 border-y border-neutral-100">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-3 gap-8">
            {[
              { value: '90%', label: '时间节省' },
              { value: '24/7', label: '全天候服务' },
              { value: '5min', label: '平均面试时长' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-4xl sm:text-5xl font-semibold text-neutral-900 tracking-tight">
                  {stat.value}
                </div>
                <div className="text-sm text-neutral-500 mt-2">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 功能特色 */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-semibold text-neutral-900 tracking-tight mb-4">
              核心功能
            </h2>
            <p className="text-neutral-500 text-lg font-light">
              简洁而强大的面试解决方案
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Mic,
                title: 'AI 语音面试',
                description: '自然流畅的语音对话，无需安装任何软件'
              },
              {
                icon: Brain,
                title: '智能问题生成',
                description: '根据岗位和回答，动态生成针对性问题'
              },
              {
                icon: FileText,
                title: '自动评分报告',
                description: '多维度评估，自动生成详细面试报告'
              },
              {
                icon: Clock,
                title: '高效筛选',
                description: '7×24 小时自动面试，大幅节省初筛时间'
              },
              {
                icon: Shield,
                title: '安全可靠',
                description: '一次性链接，数据加密，保护隐私'
              },
              {
                icon: Smartphone,
                title: '便捷体验',
                description: '支持手机和电脑，随时随地完成面试'
              }
            ].map((feature) => (
              <div
                key={feature.title}
                className="group p-6 rounded-2xl hover:bg-neutral-50 transition-colors duration-300"
              >
                <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center mb-4 group-hover:bg-neutral-200 transition-colors">
                  <feature.icon className="w-6 h-6 text-neutral-700" />
                </div>
                <h3 className="text-lg font-medium text-neutral-900 mb-2">{feature.title}</h3>
                <p className="text-neutral-500 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 工作流程 */}
      <section className="py-24 px-6 bg-neutral-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-semibold text-neutral-900 tracking-tight mb-4">
              简单四步
            </h2>
            <p className="text-neutral-500 text-lg font-light">
              从创建到报告，全程自动化
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { step: '01', title: '创建岗位', desc: '选择面试模板' },
              { step: '02', title: '生成链接', desc: '发送给候选人' },
              { step: '03', title: 'AI 面试', desc: '自动进行面试' },
              { step: '04', title: '查看报告', desc: '做出录用决策' },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="text-6xl font-light text-neutral-200 mb-4">
                  {item.step}
                </div>
                <h3 className="text-lg font-medium text-neutral-900 mb-1">{item.title}</h3>
                <p className="text-neutral-500 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 适用岗位 */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-semibold text-neutral-900 tracking-tight mb-4">
              适用岗位
            </h2>
            <p className="text-neutral-500 text-lg font-light">
              预置专业面试模板
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              { title: '项目经理', skills: ['项目管理', '沟通协调', '风险控制', '团队领导'] },
              { title: '产品经理', skills: ['需求分析', '产品规划', '用户思维', '数据分析'] },
              { title: '销售人员', skills: ['客户开发', '谈判技巧', '业绩导向', '抗压能力'] },
            ].map((position) => (
              <div
                key={position.title}
                className="p-6 rounded-2xl border border-neutral-200 hover:border-neutral-300 hover:shadow-sm transition-all duration-300"
              >
                <h3 className="text-xl font-medium text-neutral-900 mb-4">{position.title}</h3>
                <div className="flex flex-wrap gap-2">
                  {position.skills.map((skill) => (
                    <span
                      key={skill}
                      className="px-3 py-1 text-sm text-neutral-600 bg-neutral-100 rounded-full"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA 区域 */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-semibold text-neutral-900 tracking-tight mb-4">
            准备好了吗？
          </h2>
          <p className="text-neutral-500 text-lg font-light mb-8">
            立即开始使用 AI 面试系统，让招聘更智能
          </p>
          <Link href="/login">
            <Button size="lg" className="bg-neutral-900 hover:bg-neutral-800 text-white px-10 h-12 text-base rounded-full">
              免费开始
              <ArrowRight className="ml-2 w-4 h-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* 演示模态框 */}
      <Dialog open={showDemo} onOpenChange={setShowDemo}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold text-center">
              AI 面试系统演示
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-8 py-4">
            {/* 演示流程 */}
            <div className="grid gap-6">
              {/* 步骤 1 */}
              <div className="flex gap-4 p-4 rounded-xl bg-neutral-50">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-neutral-900 mb-1">1. HR 创建面试</h3>
                  <p className="text-sm text-neutral-500 mb-3">
                    HR 在后台选择岗位模板，填写候选人信息，一键生成专属面试链接
                  </p>
                  <div className="rounded-lg overflow-hidden border border-neutral-200">
                    <Image
                      src="/demo/positions-management.png"
                      alt="岗位管理后台"
                      width={800}
                      height={450}
                      className="w-full h-auto"
                    />
                  </div>
                </div>
              </div>

              {/* 步骤 2 */}
              <div className="flex gap-4 p-4 rounded-xl bg-neutral-50">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                  <MessageSquare className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-neutral-900 mb-1">2. 候选人语音面试</h3>
                  <p className="text-sm text-neutral-500 mb-3">
                    候选人打开链接，AI 面试官自动提问，支持语音实时对话
                  </p>
                  <div className="rounded-lg overflow-hidden border border-neutral-200">
                    <Image
                      src="/demo/interview-page.png"
                      alt="候选人面试界面"
                      width={800}
                      height={450}
                      className="w-full h-auto"
                    />
                  </div>
                </div>
              </div>

              {/* 步骤 3 */}
              <div className="flex gap-4 p-4 rounded-xl bg-neutral-50">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <BarChart3 className="w-6 h-6 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-neutral-900 mb-1">3. AI 智能评估</h3>
                  <p className="text-sm text-neutral-500 mb-3">
                    AI 实时分析回答内容，从多个维度进行专业评估
                  </p>
                  <div className="rounded-lg overflow-hidden border border-neutral-200">
                    <Image
                      src="/demo/interviews-management.png"
                      alt="面试管理与评估"
                      width={800}
                      height={450}
                      className="w-full h-auto"
                    />
                  </div>
                </div>
              </div>

              {/* 步骤 4 */}
              <div className="flex gap-4 p-4 rounded-xl bg-neutral-50">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-neutral-900 mb-1">4. 生成面试报告</h3>
                  <p className="text-sm text-neutral-500 mb-3">
                    自动生成详细报告，包含评分、优势、风险点和录用建议
                  </p>
                  <div className="rounded-lg overflow-hidden border border-neutral-200">
                    <Image
                      src="/demo/dashboard-overview.png"
                      alt="面试报告与数据概览"
                      width={800}
                      height={450}
                      className="w-full h-auto"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="text-center pt-4 border-t border-neutral-100">
              <p className="text-neutral-500 mb-4">立即体验 AI 面试系统</p>
              <Link href="/login">
                <Button
                  className="bg-neutral-900 hover:bg-neutral-800 text-white px-8 h-11 rounded-full"
                  onClick={() => setShowDemo(false)}
                >
                  开始使用
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 页脚 */}
      <footer className="py-8 px-6 border-t border-neutral-100">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-neutral-900 flex items-center justify-center">
              <Mic className="w-3 h-3 text-white" />
            </div>
            <span className="text-neutral-500 text-sm">AI 面试官</span>
          </div>
          <p className="text-neutral-400 text-sm">
            © 2024 AI Voice Interview System
          </p>
        </div>
      </footer>
    </div>
  )
}
