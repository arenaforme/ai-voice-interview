import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db/prisma'
import bcrypt from 'bcryptjs'

// 密码安全要求验证
function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('密码长度至少 8 位')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('密码必须包含大写字母')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('密码必须包含小写字母')
  }
  if (!/[0-9]/.test(password)) {
    errors.push('密码必须包含数字')
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('密码必须包含特殊字符')
  }

  return { valid: errors.length === 0, errors }
}

export async function POST(request: Request) {
  try {
    const session = await auth()

    if (!session?.user?.email) {
      return NextResponse.json({ error: '未登录' }, { status: 401 })
    }

    const { currentPassword, newPassword, confirmPassword } = await request.json()

    // 验证必填字段
    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json({ error: '请填写所有字段' }, { status: 400 })
    }

    // 验证两次密码一致
    if (newPassword !== confirmPassword) {
      return NextResponse.json({ error: '两次输入的新密码不一致' }, { status: 400 })
    }

    // 验证新密码安全性
    const validation = validatePassword(newPassword)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.errors.join('；') }, { status: 400 })
    }

    // 获取用户信息
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    })

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })
    }

    // 验证当前密码
    const isValidPassword = await bcrypt.compare(currentPassword, user.password)
    if (!isValidPassword) {
      return NextResponse.json({ error: '当前密码错误' }, { status: 400 })
    }

    // 验证新密码不能与旧密码相同
    const isSamePassword = await bcrypt.compare(newPassword, user.password)
    if (isSamePassword) {
      return NextResponse.json({ error: '新密码不能与当前密码相同' }, { status: 400 })
    }

    // 加密新密码并更新
    const hashedPassword = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { email: session.user.email },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
      },
    })

    return NextResponse.json({ success: true, message: '密码修改成功' })
  } catch (error) {
    console.error('修改密码失败:', error)
    return NextResponse.json({ error: '修改密码失败' }, { status: 500 })
  }
}
