import { minioClient } from './minio'

const RESUME_BUCKET = process.env.MINIO_RESUME_BUCKET || 'interview-resumes'

/**
 * 确保简历存储桶存在
 */
export async function ensureResumeBucket(): Promise<void> {
  const exists = await minioClient.bucketExists(RESUME_BUCKET)
  if (!exists) {
    await minioClient.makeBucket(RESUME_BUCKET)
  }
}

/**
 * 上传简历文件
 */
export async function uploadResume(
  fileKey: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  await ensureResumeBucket()

  await minioClient.putObject(RESUME_BUCKET, fileKey, buffer, buffer.length, {
    'Content-Type': contentType,
  })

  return fileKey
}

/**
 * 获取简历文件的预签名 URL（用于预览/下载）
 */
export async function getResumeUrl(
  fileKey: string,
  expiry: number = 3600
): Promise<string> {
  return await minioClient.presignedGetObject(RESUME_BUCKET, fileKey, expiry)
}

/**
 * 获取简历文件内容
 */
export async function getResumeBuffer(fileKey: string): Promise<Buffer> {
  const stream = await minioClient.getObject(RESUME_BUCKET, fileKey)
  const chunks: Buffer[] = []

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(chunk))
    stream.on('end', () => resolve(Buffer.concat(chunks)))
    stream.on('error', reject)
  })
}

/**
 * 删除简历文件
 */
export async function deleteResume(fileKey: string): Promise<void> {
  await minioClient.removeObject(RESUME_BUCKET, fileKey)
}

/**
 * 批量删除简历文件
 */
export async function deleteResumes(fileKeys: string[]): Promise<void> {
  if (fileKeys.length === 0) return
  await minioClient.removeObjects(RESUME_BUCKET, fileKeys)
}
