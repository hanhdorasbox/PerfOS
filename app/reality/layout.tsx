import type { Metadata } from 'next'
import Link from 'next/link'
import '../invest/finance-os.css'
import './reality.css'

export const metadata: Metadata = {
  title: 'Realitní kalkulačka',
  description: 'Vyplatí se investovat do konkrétní nemovitosti? Cash flow, výnosy, návratnost.',
}

export default function RealityLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="finance-os">
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <Link href="/reality" style={{ textDecoration: 'none' }}>
          <h1 className="fin-h1" style={{ margin: 0 }}>Realitní kalkulačka</h1>
        </Link>
        <span className="fin-subtle" style={{ fontSize: 12 }}>
          vyplatí se koupit? · cash flow · výnos · návratnost
        </span>
      </header>
      {children}
    </div>
  )
}
