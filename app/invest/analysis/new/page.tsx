import NewAnalysisForm from '@/components/invest/NewAnalysisForm'

export const dynamic = 'force-dynamic'

export default function NewAnalysisPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 className="fin-serif" style={{ fontSize: 22, margin: 0 }}>New analysis</h2>
      <NewAnalysisForm />
    </div>
  )
}
