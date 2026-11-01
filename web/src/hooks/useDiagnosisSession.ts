import { useEffect, useRef, useState } from 'react'
import { ApiError, diagnosisApi, type DiagnosisApi } from '../api'
import { TOTAL_QUESTIONS } from '../api/config'
import type {
  ChatMessage,
  DiagnosisReport,
  MessageRole,
  QuestionProgress,
  SessionPhase,
} from '../types/diagnosis'

/** Which step failed, so `retry()` can re-run it. */
type FailedStep = { step: 'start' } | { step: 'answer'; text: string } | { step: 'report' }

function makeMessage(role: MessageRole, content: string, questionNumber?: number): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
    questionNumber,
  }
}

function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
}

function errorMessage(err: unknown): string {
  if (err instanceof ApiError || err instanceof Error) return err.message
  return 'Something went wrong. Please try again.'
}

/**
 * Drives one consultation: start → 5 questions/answers → report.
 * All backend access goes through the injected `api` (mock or HTTP).
 */
export function useDiagnosisSession(api: DiagnosisApi = diagnosisApi) {
  const [phase, setPhase] = useState<SessionPhase>('idle')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [progress, setProgress] = useState<QuestionProgress>({ current: 0, total: TOTAL_QUESTIONS })
  const [report, setReport] = useState<DiagnosisReport | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sessionIdRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const failedRef = useRef<FailedStep | null>(null)

  useEffect(() => () => abortRef.current?.abort(), [])

  /** Cancels any in-flight request and returns a signal for the next one. */
  function newSignal(): AbortSignal {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    return abortRef.current.signal
  }

  function fail(err: unknown, failed: FailedStep) {
    if (isAbort(err)) return
    failedRef.current = failed
    setError(errorMessage(err))
    setPhase('error')
  }

  async function fetchReport() {
    const sessionId = sessionIdRef.current
    if (!sessionId) return
    setPhase('generating')
    setError(null)
    try {
      setReport(await api.getReport(sessionId, newSignal()))
      setPhase('report')
    } catch (err) {
      fail(err, { step: 'report' })
    }
  }

  async function start() {
    setPhase('starting')
    setMessages([])
    setReport(null)
    setError(null)
    sessionIdRef.current = null
    try {
      const res = await api.startSession(newSignal())
      sessionIdRef.current = res.sessionId
      setProgress({ current: res.questionNumber, total: res.totalQuestions })
      setMessages([makeMessage('assistant', res.question, res.questionNumber)])
      setPhase('answering')
    } catch (err) {
      fail(err, { step: 'start' })
    }
  }

  /** `alreadyShown` is true on retry so the patient bubble isn't duplicated. */
  async function submit(text: string, alreadyShown: boolean) {
    const sessionId = sessionIdRef.current
    if (!sessionId) return
    if (!alreadyShown) setMessages((m) => [...m, makeMessage('patient', text)])
    setPhase('thinking')
    setError(null)
    try {
      const res = await api.submitAnswer(sessionId, { answer: text }, newSignal())
      if (res.status === 'complete') {
        await fetchReport()
        return
      }
      setProgress({ current: res.questionNumber, total: res.totalQuestions })
      setMessages((m) => [...m, makeMessage('assistant', res.question, res.questionNumber)])
      setPhase('answering')
    } catch (err) {
      fail(err, { step: 'answer', text })
    }
  }

  function sendAnswer(answer: string) {
    const text = answer.trim()
    if (text) void submit(text, false)
  }

  function retry() {
    const failed = failedRef.current
    failedRef.current = null
    if (!failed) return
    if (failed.step === 'start') void start()
    else if (failed.step === 'answer') void submit(failed.text, true)
    else void fetchReport()
  }

  function reset() {
    abortRef.current?.abort()
    sessionIdRef.current = null
    failedRef.current = null
    setMessages([])
    setReport(null)
    setError(null)
    setProgress({ current: 0, total: TOTAL_QUESTIONS })
    setPhase('idle')
  }

  return {
    phase,
    messages,
    progress,
    report,
    error,
    start: () => void start(),
    sendAnswer,
    retry,
    reset,
  }
}

export type DiagnosisSession = ReturnType<typeof useDiagnosisSession>
