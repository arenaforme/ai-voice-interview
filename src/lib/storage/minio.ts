import * as Minio from 'minio'

const globalForMinio = globalThis as unknown as {
  minio: Minio.Client | undefined
}

export const minioClient =
  globalForMinio.minio ??
  new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000'),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
  })

if (process.env.NODE_ENV !== 'production') {
  globalForMinio.minio = minioClient
}

const BUCKET = process.env.MINIO_BUCKET || 'interview-audio'

/**
 * 确保存储桶存在
 */
export async function ensureBucket(): Promise<void> {
  const exists = await minioClient.bucketExists(BUCKET)
  if (!exists) {
    await minioClient.makeBucket(BUCKET)
  }
}

/**
 * 上传音频文件
 */
export async function uploadAudio(
  filename: string,
  buffer: Buffer,
  contentType: string = 'audio/webm'
): Promise<string> {
  await ensureBucket()

  await minioClient.putObject(BUCKET, filename, buffer, buffer.length, {
    'Content-Type': contentType,
  })

  return `/${BUCKET}/${filename}`
}

/**
 * 获取音频文件的预签名 URL
 */
export async function getAudioUrl(filename: string, expiry: number = 3600): Promise<string> {
  return await minioClient.presignedGetObject(BUCKET, filename, expiry)
}

/**
 * 删除音频文件
 */
export async function deleteAudio(filename: string): Promise<void> {
  await minioClient.removeObject(BUCKET, filename)
}

export default minioClient
