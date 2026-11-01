import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import type { ChatMessage, QuestionProgress, SessionPhase } from '../types/diagnosis'
import { Disclaimer } from './Disclaimer'

interface ChatViewProps {
  phase: SessionPhase
  messages: ChatMessage[]
  progress: QuestionProgress
  error: string | null
  onSend: (answer: string) => void
  onRetry: () => void
  onReset: () => void
}

const MAX_ANSWER_LENGTH = 1000

function ProgressBar({ progress, done }: { progress: QuestionProgress; done: boolean }) {
  const answered = done ? progress.total : Math.max(progress.current - 1, 0)
  return (
    <div className="progress">
      <div className="progress__label">
        <span className="eyebrow">{done ? 'All questions answered' : `Question ${progress.current} of ${progress.total}`}</span>
        <span className="progress__count">
          {answered}/{progress.total}
        </span>
      </div>
      <div
        className="progress__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-valuenow={answered}
        aria-label="Questions answered"
      >
        {Array.from({ length: progress.total }, (_, i) => (
          <span
            key={i}
            className={`progress__seg ${i < answered ? 'progress__seg--done' : ''} ${
              !done && i === answered ? 'progress__seg--active' : ''
            }`}
          />
        ))}
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isAssistant = message.role === 'assistant'
  return (
    <li className={`msg ${isAssistant ? 'msg--assistant' : 'msg--patient'}`}>
      {isAssistant && (
        <span className="msg__avatar" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z" fill="currentColor" />
          </svg>
        </span>
      )}
      <div className="msg__body">
        <span className="msg__meta">
          {isAssistant ? `Assistant${message.questionNumber ? ` · Q${message.questionNumber}` : ''}` : 'You'}
        </span>
        <p className="msg__bubble">{message.content}</p>
      </div>
    </li>
  )
}

function TypingIndicator({ label }: { label: string }) {
  return (
    <li className="msg msg--assistant" aria-live="polite">
      <span className="msg__avatar" aria-hidden="true" />
      <div className="msg__body">
        <span className="msg__meta">{label}</span>
        <p className="msg__bubble msg__bubble--typing">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </p>
      </div>
    </li>
  )
}

export function ChatView({ phase, messages, progress, error, onSend, onRetry, onReset }: ChatViewProps) {
  const [draft, setDraft] = useState('')
  const listEndRef = useRef<HTMLLIElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const canType = phase === 'answering'
  const generating = phase === 'generating'

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, phase])

  useEffect(() => {
    if (canType) inputRef.current?.focus()
  }, [canType])

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    const text = draft.trim()
    if (!canType || !text) return
    onSend(text)
    setDraft('')
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <main className="chat container">
      <div className="chat__panel">
        <ProgressBar progress={progress} done={generating} />

        <ol className="chat__messages" aria-live="polite">
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {phase === 'starting' && <TypingIndicator label="Assistant · connecting" />}
          {phase === 'thinking' && <TypingIndicator label="Assistant · thinking" />}
          {generating && <TypingIndicator label="Assistant · writing your report" />}
          <li ref={listEndRef} aria-hidden="true" className="chat__end" />
        </ol>

        {phase === 'error' && (
          <div className="alert" role="alert">
            <div>
              <strong>Something went wrong.</strong>
              <p>{error}</p>
            </div>
            <div className="alert__actions">
              <button type="button" className="btn btn--primary" onClick={onRetry}>
                Try again
              </button>
              <button type="button" className="btn btn--outline" onClick={onReset}>
                Start over
              </button>
            </div>
          </div>
        )}

        <form className="composer" onSubmit={submit}>
          <label htmlFor="answer" className="sr-only">
            Your answer
          </label>
          <textarea
            id="answer"
            ref={inputRef}
            className="composer__input"
            placeholder={
              generating
                ? 'Your report is being generated…'
                : canType
                  ? 'Type your answer…'
                  : 'Please wait…'
            }
            value={draft}
            maxLength={MAX_ANSWER_LENGTH}
            rows={2}
            disabled={!canType}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <div className="composer__footer">
            <span className="composer__hint">Enter to send · Shift + Enter for a new line</span>
            <button type="submit" className="btn btn--primary" disabled={!canType || !draft.trim()}>
              Send
            </button>
          </div>
        </form>
      </div>
      <Disclaimer compact />
    </main>
  )
}
