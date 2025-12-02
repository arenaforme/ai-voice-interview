import Anthropic from '@anthropic-ai/sdk'

// 强制使用官方 Anthropic API，忽略系统环境变量中的第三方配置
const OFFICIAL_ANTHROPIC_BASE_URL = 'https://api.anthropic.com'

// 从 .env 文件读取 API Key
const apiKey = process.env.ANTHROPIC_API_KEY

// 调试日志
console.log('[Anthropic Config] API Key prefix:', apiKey?.substring(0, 20) + '...')
console.log('[Anthropic Config] Using baseURL:', OFFICIAL_ANTHROPIC_BASE_URL)

const globalForAnthropic = globalThis as unknown as {
  anthropic: Anthropic | undefined
}

export const anthropic =
  globalForAnthropic.anthropic ??
  new Anthropic({
    apiKey,
    baseURL: OFFICIAL_ANTHROPIC_BASE_URL,
  })

if (process.env.NODE_ENV !== 'production') {
  globalForAnthropic.anthropic = anthropic
}

export default anthropic
