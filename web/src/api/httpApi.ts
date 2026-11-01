import { API_BASE_URL } from './config'
import { ApiError, type DiagnosisApi } from './diagnosisApi'
import type {
  DiagnosisReport,
  StartSessionResponse,
  SubmitAnswerResponse,
} from '../types/diagnosis'

/**
 * Real HTTP implementation — placeholder for the FastAPI/LangGraph backend.
 *
 * TODO(backend): implement these routes in `api/`:
 *   POST   /sessions                 → StartSessionResponse
 *   POST   /sessions/{id}/answers    → SubmitAnswerResponse   body: { answer }
 *   GET    /sessions/{id}/report     → DiagnosisReport
 * Adjust the paths below if the backend uses different ones.
 */
const ENDPOINTS = {
  startSession: () => '/sessions',
  submitAnswer: (sessionId: string) => `/sessions/${encodeURIComponent(sessionId)}/answers`,
  report: (sessionId: string) => `/sessions/${encodeURIComponent(sessionId)}/report`,
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError(0, 'Could not reach the diagnostic service. Check your connection.')
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new ApiError(res.status, detail || `Request failed (${res.status})`)
  }
  return (await res.json()) as T
}

export const httpApi: DiagnosisApi = {
  startSession(signal) {
    return request<StartSessionResponse>(ENDPOINTS.startSession(), { method: 'POST', signal })
  },

  submitAnswer(sessionId, body, signal) {
    return request<SubmitAnswerResponse>(ENDPOINTS.submitAnswer(sessionId), {
      method: 'POST',
      body: JSON.stringify(body),
      signal,
    })
  },

  getReport(sessionId, signal) {
    return request<DiagnosisReport>(ENDPOINTS.report(sessionId), { signal })
  },
}
