interface TopNavProps {
  usingMock: boolean
  inSession: boolean
  onHome: () => void
  onNewConsultation: () => void
}

export function TopNav({ usingMock, inSession, onHome, onNewConsultation }: TopNavProps) {
  return (
    <header className="top-nav no-print">
      <div className="container top-nav__inner">
        <button type="button" className="wordmark" onClick={onHome} aria-label="Go to home">
          <span className="wordmark__mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path d="M10 3h4v7h7v4h-7v7h-4v-7H3v-4h7z" fill="currentColor" />
            </svg>
          </span>
          Diagnos
        </button>

        <div className="top-nav__right">
          <span
            className="status"
            title={usingMock ? 'Using the in-browser mock API' : 'Connected to the backend API'}
          >
            <span className={`status__dot ${usingMock ? 'status__dot--mock' : ''}`} aria-hidden="true" />
            {usingMock ? 'Mock API' : 'Live API'}
          </span>
          {inSession && (
            <button type="button" className="btn btn--secondary" onClick={onNewConsultation}>
              New consultation
            </button>
          )}
        </div>
      </div>
    </header>
  )
}
