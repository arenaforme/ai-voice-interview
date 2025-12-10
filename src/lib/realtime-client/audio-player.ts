/**
 * 音频播放模块 - 流式播放 PCM16 24kHz
 * 用于 OpenAI Realtime API
 */

const SAMPLE_RATE = 24000

export class AudioPlayer {
  private audioContext: AudioContext | null = null
  private gainNode: GainNode | null = null
  private scheduledTime = 0
  private isPlaying = false
  private onPlaybackEnd: (() => void) | null = null

  async init(): Promise<void> {
    this.audioContext = new AudioContext({ sampleRate: SAMPLE_RATE })
    this.gainNode = this.audioContext.createGain()
    this.gainNode.connect(this.audioContext.destination)
    this.scheduledTime = this.audioContext.currentTime
  }

  // 播放 PCM16 音频数据
  play(pcm16Data: ArrayBuffer): void {
    if (!this.audioContext || !this.gainNode) return

    // 确保音频上下文处于运行状态
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume()
    }

    // 将 PCM16 转换为 Float32
    const int16Array = new Int16Array(pcm16Data)
    const float32Array = new Float32Array(int16Array.length)

    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768
    }

    // 创建音频缓冲区
    const audioBuffer = this.audioContext.createBuffer(
      1,
      float32Array.length,
      SAMPLE_RATE
    )
    audioBuffer.getChannelData(0).set(float32Array)

    // 创建音频源
    const source = this.audioContext.createBufferSource()
    source.buffer = audioBuffer
    source.connect(this.gainNode)

    // 计算播放时间
    const currentTime = this.audioContext.currentTime
    const startTime = Math.max(currentTime, this.scheduledTime)

    source.start(startTime)
    this.scheduledTime = startTime + audioBuffer.duration
    this.isPlaying = true

    source.onended = () => {
      if (this.audioContext && this.scheduledTime <= this.audioContext.currentTime + 0.1) {
        this.isPlaying = false
        this.onPlaybackEnd?.()
      }
    }
  }

  // 停止播放（用于打断）
  stop(): void {
    if (this.audioContext) {
      // 重置调度时间
      this.scheduledTime = this.audioContext.currentTime
      this.isPlaying = false
    }
  }

  // 设置音量 (0-1)
  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume))
    }
  }

  // 设置播放结束回调
  setOnPlaybackEnd(callback: () => void): void {
    this.onPlaybackEnd = callback
  }

  // 检查是否正在播放
  isActive(): boolean {
    return this.isPlaying
  }

  // 销毁
  destroy(): void {
    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
    this.gainNode = null
    this.isPlaying = false
  }
}
