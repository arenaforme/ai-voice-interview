import openai from './openai'

/**
 * 使用 OpenAI Whisper API 进行语音识别
 * @param audioBuffer 音频文件 Buffer
 * @param filename 文件名（用于确定格式）
 * @returns 转写文本
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  filename: string = 'audio.webm'
): Promise<string> {
  // 将 Buffer 转换为 Uint8Array 以兼容 File API
  const uint8Array = new Uint8Array(audioBuffer)
  const file = new File([uint8Array], filename, {
    type: 'audio/webm',
  })

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'zh',
    response_format: 'text',
  })

  return transcription
}
