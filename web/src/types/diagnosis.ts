/**
 * Shared types for the diagnostic chat flow.
 *
 * These mirror the contract the backend (LangGraph `MedicalState`) is expected
 * to expose over HTTP. Keep them in sync with the API once it exists.
 */

export type MessageRole = 'assistant' | 'patient'

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  /** ISO-8601 timestamp */
  createdAt: string
  /** Set on assistant questions: 1-based index of the question */
  questionNumber?: number
}

/* ---------- API contract ---------- */

/** POST /sessions → starts a consultation and returns the first question. */
export interface StartSessionResponse {
  sessionId: string
  question: string
  questionNumber: number
  totalQuestions: number
}

/** POST /sessions/:id/answers body */
export interface SubmitAnswerRequest {
  answer: string
}

/**
 * POST /sessions/:id/answers response.
 * Either the next question, or `complete` once all questions are answered
 * (the client then fetches the report).
 */
export type SubmitAnswerResponse =
  | {
      status: 'question'
      question: string
      questionNumber: number
      totalQuestions: number
    }
  | { status: 'complete' }

export type Urgency = 'low' | 'moderate' | 'high' | 'emergency'

/** GET /sessions/:id/report */
export interface DiagnosisReport {
  sessionId: string
  /** ISO-8601 timestamp */
  generatedAt: string
  /** Full report as Markdown (maps to `MedicalState.final_report`). */
  markdown: string
  /** Optional one-paragraph summary (maps to `MedicalState.diagnostic_summary`). */
  summary?: string
  /** Optional triage level, if the backend provides one. */
  urgency?: Urgency
}

/* ---------- Client state ---------- */

export type SessionPhase =
  | 'idle' // landing page, nothing started
  | 'starting' // waiting for the first question
  | 'answering' // waiting for the patient to type
  | 'thinking' // answer sent, waiting for next question
  | 'generating' // all answers in, waiting for the report
  | 'report' // report ready
  | 'error'

export interface QuestionProgress {
  current: number
  total: number
}
