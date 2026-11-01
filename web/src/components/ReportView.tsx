import { useState } from 'react'
import type { ChatMessage, DiagnosisReport, Urgency } from '../types/diagnosis'
import { Disclaimer } from './Disclaimer'
import { Markdown } from './Markdown'

interface ReportViewProps {
  report: DiagnosisReport
  messages: ChatMessage[]
  onNewConsultation: () => void
}

const URGENCY_LABEL: Record<Urgency, string> = {
  low: 'Low urgency',
  moderate: 'Moderate urgency',
  high: 'High urgency',
  emergency: 'Seek emergency care',
}

export function ReportView({ report, messages, onNewConsultation }: ReportViewProps) {
  const [copied, setCopied] = useState(false)
  const generated = new Date(report.generatedAt)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report.markdown)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <main className="report container">
      <section className="spotlight-card">
        <div className="glow glow--card" aria-hidden="true" />
        <div className="spotlight-card__content">
          <div className="report__badges">
            <span className="badge">Consultation report</span>
            {report.urgency && (
              <span className={`badge badge--urgency badge--${report.urgency}`}>
                {URGENCY_LABEL[report.urgency]}
              </span>
            )}
          </div>
          <h1 className="report__title">Your health summary</h1>
          <p className="report__meta">
            Generated {generated.toLocaleDateString()} at{' '}
            {generated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            <span className="report__ref"> · Ref {report.sessionId.slice(0, 8)}</span>
          </p>
          {report.summary && <p className="report__summary">{report.summary}</p>}
          <div className="report__actions no-print">
            <button type="button" className="btn btn--primary" onClick={() => window.print()}>
              Print / save as PDF
            </button>
            <button type="button" className="btn btn--secondary" onClick={copy}>
              {copied ? 'Copied ✓' : 'Copy report'}
            </button>
            <button type="button" className="btn btn--outline" onClick={onNewConsultation}>
              New consultation
            </button>
          </div>
        </div>
      </section>

      <article className="report__body card">
        <Markdown source={report.markdown} />
      </article>

      <details className="transcript card">
        <summary>Conversation transcript ({messages.length} messages)</summary>
        <ol className="transcript__list">
          {messages.map((m) => (
            <li key={m.id} className={`transcript__item transcript__item--${m.role}`}>
              <span className="transcript__who">
                {m.role === 'assistant' ? `Q${m.questionNumber ?? ''}` : 'A'}
              </span>
              <span>{m.content}</span>
            </li>
          ))}
        </ol>
      </details>

      <Disclaimer />
    </main>
  )
}
