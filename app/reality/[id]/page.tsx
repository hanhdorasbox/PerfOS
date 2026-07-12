import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import Calculator from '@/components/reality/Calculator'
import { propertyInputsSchema } from '@/lib/reality/schema'
import { DEFAULT_INPUTS } from '@/lib/reality/defaults'

export const dynamic = 'force-dynamic'

export default async function RealityDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params

  const analysis = await prisma.propertyAnalysis.findUnique({ where: { id } })
  if (!analysis) notFound()

  // Vstupy načteme z JSON a projdeme validací; při nekompatibilitě padneme na defaulty.
  const parsed = propertyInputsSchema.safeParse(analysis.inputs)
  const inputs = parsed.success ? parsed.data : DEFAULT_INPUTS

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Link href="/reality" className="fin-subtle" style={{ fontSize: 12, textDecoration: 'none' }}>
        ← Zpět na seznam
      </Link>
      <Calculator
        id={analysis.id}
        initialTitle={analysis.title}
        initialAddress={analysis.address ?? ''}
        initialInputs={inputs}
      />
    </div>
  )
}
