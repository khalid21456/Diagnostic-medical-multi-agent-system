import { Disclaimer } from './Disclaimer'

interface LandingProps {
  onStart: () => void
}

/** The 2×2 terminal mockup (the design system's signature) shows the agent pipeline. */
const PANES = [
  {
    label: '01 · supervisor',
    lines: ['> route(state)', '  question_count: 0', '  next → diagnostic_agent'],
  },
  {
    label: '02 · diagnostic_agent',
    lines: ['> ask()', '  "What is the main symptom', '   that brought you here?"'],
  },
  {
    label: '03 · patient_response',
    lines: ['> answer()', '  "Headache since yesterday,', '   worse in the morning."'],
  },
  {
    label: '04 · report_agent',
    lines: ['> generate_report()', '  ✓ 5 / 5 answers', '  ✓ report.md ready'],
  },
]

const STEPS = [
  {
    title: 'Describe what you feel',
    body: 'Start a consultation and tell the assistant about your main symptom in your own words.',
  },
  {
    title: 'Answer five questions',
    body: 'Each question builds on your previous answers: onset, severity, other symptoms, and history.',
  },
  {
    title: 'Receive your report',
    body: 'Get a structured summary with possible causes and next steps you can share with a physician.',
  },
]

export function Landing({ onStart }: LandingProps) {
  return (
    <main>
      <section className="hero">
        <div className="glow" aria-hidden="true" />
        <div className="container hero__inner">
          <h1 className="hero__title">
            Five questions.
            <br />
            One clear report.
          </h1>
          <p className="hero__lead">
            A guided intake that asks the right follow-up questions about your symptoms, then writes
            a structured report you can bring to your doctor.
          </p>
          <div className="hero__actions">
            <button type="button" className="btn btn--primary" onClick={onStart}>
              Start consultation
            </button>
            <a className="btn btn--outline" href="#how-it-works">
              How it works
            </a>
          </div>

          <div className="terminal-grid" aria-label="Pipeline preview">
            {PANES.map((pane) => (
              <div className="terminal-pane" key={pane.label}>
                <div className="terminal-pane__label">{pane.label}</div>
                <pre>{pane.lines.join('\n')}</pre>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="how-it-works">
        <div className="container">
          <span className="eyebrow">How it works</span>
          <h2 className="section__title">From symptom to summary in minutes</h2>
          <div className="feature-grid">
            {STEPS.map((step, i) => (
              <article className="feature-card" key={step.title}>
                <span className="feature-card__index">0{i + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
          <Disclaimer />
        </div>
      </section>
    </main>
  )
}
