import Link from 'next/link'
import Calculator from '@/components/reality/Calculator'

export const dynamic = 'force-dynamic'

export default function NewRealityPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Link href="/reality" className="fin-subtle" style={{ fontSize: 12, textDecoration: 'none' }}>
        ← Zpět na seznam
      </Link>
      <Calculator />
    </div>
  )
}
