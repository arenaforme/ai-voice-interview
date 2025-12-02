import openai from './openai'

/**
 * 使用 OpenAI TTS API 进行语音合成
 * @param text 要转换的文本
 * @returns 音频 Buffer
 */
export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const model = process.env.OPENAI_TTS_MODEL || 'tts-1'
  const voice = (process.env.OPENAI_TTS_VOICE || 'alloy') as
    | 'alloy'
    | 'echo'
    | 'fable'
    | 'onyx'
    | 'nova'
    | 'shimmer'

  const response = await openai.audio.speech.create({
    model,
    voice,
    input: text,
    response_format: 'mp3',
  })

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
