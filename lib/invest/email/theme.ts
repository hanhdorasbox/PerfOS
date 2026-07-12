// Shared styles for e-mail templates — mirrors the Finance OS dark look.
// E-mail clients need inline styles; CSS variables don't work here.

export const email = {
  bg: '#0a0a0b',
  card: '#121214',
  border: '#1f1f23',
  gold: '#c9a961',
  gain: '#4ade80',
  loss: '#f87171',
  warn: '#fbbf24',
  text: '#ececef',
  text2: '#9a9aa3',
  text3: '#62626c',
} as const

export const styles = {
  body: {
    backgroundColor: email.bg,
    color: email.text,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    margin: 0,
    padding: '24px 12px',
  },
  container: {
    maxWidth: '560px',
    margin: '0 auto',
  },
  card: {
    backgroundColor: email.card,
    border: `1px solid ${email.border}`,
    borderRadius: '12px',
    padding: '20px 24px',
    marginBottom: '14px',
  },
  h1: {
    fontSize: '20px',
    fontWeight: 700 as const,
    letterSpacing: '-0.02em',
    margin: '0 0 4px',
    color: email.text,
  },
  label: {
    fontSize: '11px',
    fontWeight: 500 as const,
    letterSpacing: '0.09em',
    textTransform: 'uppercase' as const,
    color: email.text3,
    margin: '0 0 10px',
  },
  bigNumber: {
    fontSize: '32px',
    fontWeight: 700 as const,
    letterSpacing: '-0.02em',
    margin: '0',
    color: email.text,
  },
  text: {
    fontSize: '14px',
    lineHeight: '1.5',
    color: email.text2,
    margin: '0 0 6px',
  },
  small: {
    fontSize: '12px',
    color: email.text3,
    margin: '0',
  },
  mono: {
    fontFamily: "ui-monospace, 'SF Mono', Menlo, monospace",
  },
} as const
