// 面试相关类型定义

export interface InterviewQuestion {
  roundNumber: number
  questionText: string
  questionAudioUrl?: string
  dimension: string
}

export interface InterviewAnswer {
  roundNumber: number
  answerText: string
  answerAudioUrl: string
  score: number
  evaluation: string
  durationSeconds: number
}

export interface InterviewReportData {
  dimensionScores: Record<string, number>
  strengths: string[]
  risks: string[]
  recommendation: 'RECOMMENDED' | 'CAUTIOUS' | 'NOT_RECOMMENDED'
  summary: string
}

export interface CandidateInterviewState {
  token: string
  positionName: string
  candidateName: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
  currentRound: number
  maxRounds: number
  currentQuestion?: InterviewQuestion
}

// API 响应类型
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

export interface StartInterviewResponse {
  question: InterviewQuestion
}

export interface SubmitAnswerResponse {
  isComplete: boolean
  nextQuestion?: InterviewQuestion
  report?: InterviewReportData
}
