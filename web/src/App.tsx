import { USE_MOCK_API } from './api'
import { ChatView } from './components/ChatView'
import { Landing } from './components/Landing'
import { ReportView } from './components/ReportView'
import { TopNav } from './components/TopNav'
import { useDiagnosisSession } from './hooks/useDiagnosisSession'

function App() {
  const session = useDiagnosisSession()
  const { phase, messages, progress, report, error } = session
  const inSession = phase !== 'idle'

  return (
    <div className="app">
      <TopNav
        usingMock={USE_MOCK_API}
        inSession={inSession}
        onHome={session.reset}
        onNewConsultation={session.start}
      />

      {!inSession ? (
        <Landing onStart={session.start} />
      ) : phase === 'report' && report ? (
        <ReportView report={report} messages={messages} onNewConsultation={session.start} />
      ) : (
        <ChatView
          phase={phase}
          messages={messages}
          progress={progress}
          error={error}
          onSend={session.sendAnswer}
          onRetry={session.retry}
          onReset={session.reset}
        />
      )}
    </div>
  )
}

export default App
