/**
 * 音频采集模块 - 24kHz PCM16 格式
 * 用于 OpenAI Realtime API
 */

const TARGET_SAMPLE_RATE = 24000

export class AudioRecorder {
  private audioContext: AudioContext | null = null
  private mediaStream: MediaStream | null = null
  private workletNode: AudioWorkletNode | null = null
  private onAudioData: ((data: ArrayBuffer) => void) | null = null
  private isRecording = false

  async start(onAudioData: (data: ArrayBuffer) => void): Promise<void> {
    this.onAudioData = onAudioData

    // 获取麦克风权限
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: TARGET_SAMPLE_RATE,
        echoCancellation: true,
        noiseSuppression: true,
      },
    })

    // 创建音频上下文
    this.audioContext = new AudioContext({ sampleRate: TARGET_SAMPLE_RATE })

    // 创建音频处理器
    await this.audioContext.audioWorklet.addModule(
      this.createWorkletProcessor()
    )

    const source = this.audioContext.createMediaStreamSource(this.mediaStream)
    this.workletNode = new AudioWorkletNode(
      this.audioContext,
      'pcm16-processor'
    )

    this.workletNode.port.onmessage = (event) => {
      if (this.isRecording && this.onAudioData) {
        this.onAudioData(event.data)
      }
    }

    source.connect(this.workletNode)
    // 不连接到 destination，避免回声
    // this.workletNode.connect(this.audioContext.destination)

    this.isRecording = true
  }

  private createWorkletProcessor(): string {
    const processorCode = `
      class PCM16Processor extends AudioWorkletProcessor {
        constructor() {
          super();
          this.buffer = [];
          this.bufferSize = 2400; // 100ms at 24kHz
        }

        process(inputs) {
          const input = inputs[0];
          if (input.length > 0) {
            const samples = input[0];
            for (let i = 0; i < samples.length; i++) {
              this.buffer.push(samples[i]);
            }

            while (this.buffer.length >= this.bufferSize) {
              const chunk = this.buffer.splice(0, this.bufferSize);
              const pcm16 = this.floatToPCM16(chunk);
              this.port.postMessage(pcm16.buffer);
            }
          }
          return true;
        }

        floatToPCM16(floatSamples) {
          const pcm16 = new Int16Array(floatSamples.length);
          for (let i = 0; i < floatSamples.length; i++) {
            const s = Math.max(-1, Math.min(1, floatSamples[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          return pcm16;
        }
      }

      registerProcessor('pcm16-processor', PCM16Processor);
    `

    const blob = new Blob([processorCode], { type: 'application/javascript' })
    return URL.createObjectURL(blob)
  }

  stop(): void {
    this.isRecording = false

    if (this.workletNode) {
      this.workletNode.disconnect()
      this.workletNode = null
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop())
      this.mediaStream = null
    }

    if (this.audioContext) {
      this.audioContext.close()
      this.audioContext = null
    }
  }

  isActive(): boolean {
    return this.isRecording
  }
}
