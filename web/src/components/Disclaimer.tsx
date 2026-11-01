export function Disclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`disclaimer ${compact ? 'disclaimer--compact' : ''}`} role="note">
      <strong>Not a medical diagnosis.</strong> This assistant gives general information only and
      does not replace a qualified healthcare professional.
      {!compact && ' If you have chest pain, trouble breathing, severe bleeding, or think you may be having an emergency, call your local emergency number now.'}
    </p>
  )
}
