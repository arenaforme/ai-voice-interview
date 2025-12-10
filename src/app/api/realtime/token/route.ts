import { NextResponse } from 'next/server'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

/**
 * 生成 OpenAI Realtime API 的 ephemeral token
 * 用于浏览器直连 OpenAI WebSocket
 */
export async function POST() {
  try {
    if (!OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    // 调用 OpenAI API 生成 ephemeral token
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: 'alloy',
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Failed to create ephemeral token:', error)
      return NextResponse.json(
        { error: 'Failed to create session' },
        { status: response.status }
      )
    }

    const data = await response.json()

    return NextResponse.json({
      token: data.client_secret?.value,
      expiresAt: data.client_secret?.expires_at,
    })
  } catch (error) {
    console.error('Error creating ephemeral token:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
