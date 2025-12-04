import openai from './openai'
import mammoth from 'mammoth'

// 使用环境变量配置模型，支持 OpenAI 兼容 API
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

export interface ParsedResume {
  candidateName: string | null
  phone: string | null
  email: string | null
  education: string | null
  school: string | null
  major: string | null
  workYears: number | null
  expectedSalary: string | null
  skills: string[]
}

/**
 * 从 PDF 文件提取文本
 * 使用 pdf2json 库，纯 Node.js 实现，无浏览器 API 依赖
 */
export async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PDFParser = require('pdf2json')

  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser()

    pdfParser.on('pdfParser_dataReady', (pdfData: {
      Pages: Array<{
        Texts: Array<{ R: Array<{ T: string }> }>
      }>
    }) => {
      try {
        // 安全解码函数，处理 URI 编码错误
        const safeDecode = (str: string): string => {
          try {
            return decodeURIComponent(str)
          } catch {
            // 如果解码失败，尝试替换常见的编码问题后再解码
            try {
              return decodeURIComponent(str.replace(/%(?![0-9A-Fa-f]{2})/g, '%25'))
            } catch {
              return str // 最后返回原始字符串
            }
          }
        }

        // 提取所有页面的文本
        const text = pdfData.Pages.map((page) =>
          page.Texts.map((textItem) =>
            textItem.R.map((r) => safeDecode(r.T)).join('')
          ).join(' ')
        ).join('\n')
        resolve(text)
      } catch (err) {
        reject(err)
      }
    })

    pdfParser.on('pdfParser_dataError', (errData: { parserError: Error }) => {
      reject(errData.parserError)
    })

    pdfParser.parseBuffer(buffer)
  })
}

/**
 * 从 DOC/DOCX 文件提取文本
 */
export async function extractTextFromWord(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

/**
 * 根据文件类型提取文本
 */
export async function extractText(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (mimeType === 'application/pdf') {
    return extractTextFromPDF(buffer)
  }
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return extractTextFromWord(buffer)
  }
  throw new Error(`Unsupported file type: ${mimeType}`)
}

const PARSE_PROMPT = `你是一个专业的简历解析助手。请从以下简历文本中提取关键信息，并以 JSON 格式返回。

要求：
1. 仔细阅读简历内容，提取以下字段
2. 如果某个字段在简历中找不到，返回 null
3. 工作年限请计算总年数，返回整数
4. 技能标签提取关键技术技能，返回数组
5. 只返回 JSON，不要有其他内容

返回格式：
{
  "candidateName": "姓名",
  "phone": "手机号",
  "email": "邮箱",
  "education": "最高学历（如：本科、硕士、博士）",
  "school": "毕业院校",
  "major": "专业",
  "workYears": 工作年限数字,
  "expectedSalary": "期望薪资",
  "skills": ["技能1", "技能2", "技能3"]
}

简历内容：
`

/**
 * 使用 Claude API 解析简历文本
 */
export async function parseResumeWithAI(text: string): Promise<ParsedResume> {
  // 限制文本长度，避免 token 超限
  const truncatedText = text.slice(0, 15000)

  const response = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: PARSE_PROMPT + truncatedText,
      },
    ],
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('Unexpected response type')
  }

  // 提取 JSON
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Failed to extract JSON from response')
  }

  const parsed = JSON.parse(jsonMatch[0]) as ParsedResume
  return {
    candidateName: parsed.candidateName || null,
    phone: parsed.phone || null,
    email: parsed.email || null,
    education: parsed.education || null,
    school: parsed.school || null,
    major: parsed.major || null,
    workYears: parsed.workYears || null,
    expectedSalary: parsed.expectedSalary || null,
    skills: Array.isArray(parsed.skills) ? parsed.skills : [],
  }
}

/**
 * 完整的简历解析流程
 */
export async function parseResume(
  buffer: Buffer,
  mimeType: string
): Promise<{ rawText: string; parsed: ParsedResume }> {
  const rawText = await extractText(buffer, mimeType)
  const parsed = await parseResumeWithAI(rawText)
  return { rawText, parsed }
}
