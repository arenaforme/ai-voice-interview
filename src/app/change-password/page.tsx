'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Mic, Check, X, Eye, EyeOff, Shield } from 'lucide-react'
import Link from 'next/link'

// 密码要求检查
function checkPasswordRequirements(password: string) {
  return {
    minLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(password),
  }
}

// 计算密码强度
function getPasswordStrength(requirements: ReturnType<typeof checkPasswordRequirements>) {
  const passed = Object.values(requirements).filter(Boolean).length
  if (passed <= 2) return { level: 'weak', label: '弱', color: 'bg-red-500' }
  if (passed <= 4) return { level: 'medium', label: '中', color: 'bg-yellow-500' }
  return { level: 'strong', label: '强', color: 'bg-green-500' }
}

export default function ChangePasswordPage() {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const requirements = useMemo(() => checkPasswordRequirements(newPassword), [newPassword])
  const strength = useMemo(() => getPasswordStrength(requirements), [requirements])
  const allRequirementsMet = Object.values(requirements).every(Boolean)
  const passwordsMatch = newPassword === confirmPassword && confirmPassword !== ''

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!allRequirementsMet) {
      setError('请确保密码满足所有安全要求')
      return
    }

    if (!passwordsMatch) {
      setError('两次输入的新密码不一致')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '修改密码失败')
        return
      }

      // 修改成功，跳转到 dashboard
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('修改密码失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  const requirementItems = [
    { key: 'minLength', label: '至少 8 个字符', met: requirements.minLength },
    { key: 'hasUppercase', label: '包含大写字母', met: requirements.hasUppercase },
    { key: 'hasLowercase', label: '包含小写字母', met: requirements.hasLowercase },
    { key: 'hasNumber', label: '包含数字', met: requirements.hasNumber },
    { key: 'hasSpecial', label: '包含特殊字符', met: requirements.hasSpecial },
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* 顶部导航 */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-neutral-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex justify-between items-center h-14">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center">
                <Mic className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-semibold text-neutral-900">AI 面试官</span>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: '/' })}
              className="text-neutral-500 hover:text-neutral-900"
            >
              退出登录
            </Button>
          </div>
        </div>
      </nav>

      {/* 修改密码表单 */}
      <div className="min-h-screen flex items-center justify-center pt-14 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-center mb-2">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                <Shield className="w-6 h-6 text-amber-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-center">修改密码</CardTitle>
            <CardDescription className="text-center">
              首次登录需要修改默认密码以确保账户安全
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* 当前密码 */}
              <div className="space-y-2">
                <Label htmlFor="currentPassword">当前密码</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? 'text' : 'password'}
                    placeholder="请输入当前密码"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* 新密码 */}
              <div className="space-y-2">
                <Label htmlFor="newPassword">新密码</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="请输入新密码"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* 密码强度指示器 */}
                {newPassword && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${strength.color} transition-all duration-300`}
                          style={{ width: `${(Object.values(requirements).filter(Boolean).length / 5) * 100}%` }}
                        />
                      </div>
                      <span className={`text-xs font-medium ${
                        strength.level === 'weak' ? 'text-red-500' :
                        strength.level === 'medium' ? 'text-yellow-500' : 'text-green-500'
                      }`}>
                        {strength.label}
                      </span>
                    </div>

                    {/* 密码要求列表 */}
                    <div className="grid grid-cols-2 gap-1">
                      {requirementItems.map((item) => (
                        <div key={item.key} className="flex items-center gap-1.5 text-xs">
                          {item.met ? (
                            <Check className="w-3 h-3 text-green-500" />
                          ) : (
                            <X className="w-3 h-3 text-neutral-300" />
                          )}
                          <span className={item.met ? 'text-green-600' : 'text-neutral-400'}>
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* 确认新密码 */}
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">确认新密码</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="请再次输入新密码"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && (
                  <div className="flex items-center gap-1.5 text-xs">
                    {passwordsMatch ? (
                      <>
                        <Check className="w-3 h-3 text-green-500" />
                        <span className="text-green-600">密码匹配</span>
                      </>
                    ) : (
                      <>
                        <X className="w-3 h-3 text-red-500" />
                        <span className="text-red-500">密码不匹配</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading || !allRequirementsMet || !passwordsMatch}
              >
                {loading ? '修改中...' : '确认修改'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
