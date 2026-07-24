import Link from 'next/link'

interface Props {
  label: string
  action?: { href: string; label: string }
  children: React.ReactNode
}

// Uniform right-column card: uppercase label row + optional action link.
export default function SideCard({ label, action, children }: Props) {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E76' }}>
          {label}
        </div>
        {action && (
          <Link href={action.href} style={{ fontSize: 11, color: '#a085ff', textDecoration: 'none' }}>
            {action.label}
          </Link>
        )}
      </div>
      {children}
    </div>
  )
}
