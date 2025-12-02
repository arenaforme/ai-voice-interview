import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { pathname } = req.nextUrl
  const isLoggedIn = !!req.auth

  // 公开路由
  const publicRoutes = ['/login', '/interview']
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route))

  // API 路由中的公开接口
  const publicApiRoutes = ['/api/auth', '/api/interview/candidate']
  const isPublicApi = publicApiRoutes.some((route) => pathname.startsWith(route))

  // 静态资源
  if (pathname.startsWith('/_next') || pathname.includes('.')) {
    return NextResponse.next()
  }

  // 公开路由和 API 直接放行
  if (isPublicRoute || isPublicApi) {
    return NextResponse.next()
  }

  // 未登录用户重定向到登录页
  if (!isLoggedIn) {
    const loginUrl = new URL('/login', req.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
