import type {
  DiagnosisReport,
  StartSessionResponse,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
} from '../types/diagnosis'

/**
 * Every backend call the UI makes goes through this interface.
 * Swap implementations (mock ⇄ HTTP) in `api/index.ts` — no component changes needed.
 */
export interface DiagnosisApi {
  startSession(signal?: AbortSignal): Promise<StartSessionResponse>
  submitAnswer(
    sessionId: string,
    body: SubmitAnswerRequest,
    signal?: AbortSignal,
  ): Promise<SubmitAnswerResponse>
  getReport(sessionId: string, signal?: AbortSignal): Promise<DiagnosisReport>
}

export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}
