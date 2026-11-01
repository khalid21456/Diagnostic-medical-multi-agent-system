import { TOTAL_QUESTIONS } from './config'
import { ApiError, type DiagnosisApi } from './diagnosisApi'
import type { DiagnosisReport } from '../types/diagnosis'

/**
 * In-memory stand-in for the backend so the UI can be built and demoed
 * before the real API exists. Delete or keep for tests once the backend is live.
 */

const QUESTIONS = [
  'Hello, I will ask you a few short questions. What is the main symptom that brought you here today?',
  'When did this symptom start, and has it been getting better, worse, or staying the same?',
  'On a scale from 1 to 10, how severe is it right now, and does anything make it better or worse?',
  'Do you have any other symptoms, such as fever, nausea, dizziness, or shortness of breath?',
  'Do you have any existing medical conditions, allergies, or take any medications regularly?',
]

interface MockSession {
  answers: string[]
}

const sessions = new Map<string, MockSession>()

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const t = setTimeout(resolve, ms)
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        reject(new DOMException('Aborted', 'AbortError'))
      },
      { once: true },
    )
  })
}

function getSession(id: string): MockSession {
  const s = sessions.get(id)
  if (!s) throw new ApiError(404, 'Session not found')
  return s
}

function buildReport(sessionId: string, answers: string[]): DiagnosisReport {
  const [main, onset, severity, other, history] = answers
  return {
    sessionId,
    generatedAt: new Date().toISOString(),
    urgency: 'moderate',
    summary: `Patient reports "${main}". Mock report: replace with the output of the report agent.`,
    markdown: [
      '## Reported symptoms',
      `- **Main complaint:** ${main}`,
      `- **Onset and evolution:** ${onset}`,
      `- **Severity:** ${severity}`,
      `- **Associated symptoms:** ${other}`,
      '',
      '## Medical history',
      `- ${history}`,
      '',
      '## Preliminary assessment',
      'This is **placeholder text** produced by the mock API. The real report agent will analyse the answers above and describe possible causes.',
      '',
      '## Suggested next steps',
      '1. Rest and stay hydrated while monitoring your symptoms.',
      '2. Book an appointment with a physician to confirm the assessment.',
      '3. Seek emergency care immediately if symptoms suddenly worsen.',
    ].join('\n'),
  }
}

export const mockApi: DiagnosisApi = {
  async startSession(signal) {
    await delay(600, signal)
    const sessionId = crypto.randomUUID()
    sessions.set(sessionId, { answers: [] })
    return {
      sessionId,
      question: QUESTIONS[0],
      questionNumber: 1,
      totalQuestions: TOTAL_QUESTIONS,
    }
  },

  async submitAnswer(sessionId, { answer }, signal) {
    await delay(900, signal)
    const session = getSession(sessionId)
    session.answers.push(answer)
    const answered = session.answers.length
    if (answered >= TOTAL_QUESTIONS) return { status: 'complete' }
    return {
      status: 'question',
      question: QUESTIONS[answered],
      questionNumber: answered + 1,
      totalQuestions: TOTAL_QUESTIONS,
    }
  },

  async getReport(sessionId, signal) {
    await delay(1800, signal)
    return buildReport(sessionId, getSession(sessionId).answers)
  },
}
