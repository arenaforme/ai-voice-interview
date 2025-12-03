/**
 * 自定义 Next.js 服务器，支持 WebSocket
 * 用于 OpenAI Realtime API 中继
 *
 * 注意：Next.js 16 使用 Turbopack，自定义服务器需要禁用 Turbopack
 */
import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { setupWebSocketServer } from './src/lib/realtime/websocket-server'

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

// 禁用 Turbopack 以支持自定义服务器
const app = next({
  dev,
  hostname,
  port,
  // @ts-expect-error - turbopack option exists but not in types
  turbopack: false
})
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // 设置 WebSocket 服务器
  setupWebSocketServer(server)

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
    console.log(`> WebSocket server ready for Realtime API relay`)
  })
})
