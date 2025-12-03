/**
 * 独立 WebSocket 服务器
 * 用于 OpenAI Realtime API 中继
 * 运行在端口 3001，与 Next.js 开发服务器分离
 */
import { createServer } from 'http'
import { setupWebSocketServer } from './src/lib/realtime/websocket-server'

const port = parseInt(process.env.WS_PORT || '3001', 10)

const server = createServer((req, res) => {
  // 健康检查端点
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', service: 'websocket-server' }))
    return
  }
  res.writeHead(404)
  res.end('Not Found')
})

// 设置 WebSocket 服务器
setupWebSocketServer(server)

server.listen(port, () => {
  console.log(`> WebSocket server ready on http://localhost:${port}`)
  console.log(`> WebSocket endpoint: ws://localhost:${port}/api/realtime`)
})
