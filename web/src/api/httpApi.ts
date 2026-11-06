import { API_BASE_URL } from './config'
import { ApiError, type DiagnosisApi } from './diagnosisApi'
import type {
  DiagnosisReport,
  StartSessionResponse,
  SubmitAnswerResponse,
} from '../types/diagnosis'

/**
 * Real HTTP implementation, talking to the FastAPI/LangGraph backend
 * (routes in `api/src/routes/sessions.py`, see DOCUMENTATION.md):
 *   POST   /sessions                 → StartSessionResponse
 *   POST   /sessions/{id}/answers    → SubmitAnswerResponse   body: { answer }
 *   GET    /sessions/{id}/report     → DiagnosisReport
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
    throw new ApiError(res.status, await errorDetail(res))
  }
  return (await res.json()) as T
}

/**
 * FastAPI errors look like `{"detail": "message"}` (HTTPException) or
 * `{"detail": [{"msg": "..."}, ...]}` (validation errors, 422).
 */
async function errorDetail(res: Response): Promise<string> {
  const fallback = `Request failed (${res.status})`
  const text = await res.text().catch(() => '')
  try {
    const { detail } = JSON.parse(text) as { detail?: unknown }
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      return detail.map((d: { msg?: string }) => d.msg ?? '').filter(Boolean).join('; ') || fallback
    }
  } catch {
    // not JSON: fall through to the raw text
  }
  return text || fallback
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
