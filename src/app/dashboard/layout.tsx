'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Briefcase, Users, FileText, LogOut, Key, Loader2 } from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: '概览', icon: LayoutDashboard },
  { href: '/dashboard/positions', label: '岗位管理', icon: Briefcase },
  { href: '/dashboard/interviews', label: '面试管理', icon: Users },
  { href: '/dashboard/templates', label: '模板管理', icon: FileText },
]

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  // 检查是否需要强制修改密码
  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/auth/check-password-status')
        .then((res) => res.json())
        .then((data) => {
          if (data.mustChangePassword) {
            router.push('/change-password')
          } else {
            setChecking(false)
          }
        })
        .catch(() => setChecking(false))
    } else if (status === 'unauthenticated') {
      setChecking(false)
    }
  }, [status, router])

  // 显示加载状态
  if (checking || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="text-xl font-bold">AI 面试系统</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {session?.user?.name || session?.user?.email}
              </span>
              <Link href="/change-password">
                <Button variant="ghost" size="sm">
                  <Key className="h-4 w-4 mr-2" />
                  修改密码
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut({ callbackUrl: '/' })}
              >
                <LogOut className="h-4 w-4 mr-2" />
                退出
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* 侧边导航 */}
          <nav className="w-48 flex-shrink-0">
            <ul className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(item.href))

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* 主内容区 */}
          <main className="flex-1">{children}</main>
        </div>
      </div>
    </div>
  )
}
