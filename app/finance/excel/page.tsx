import { prisma } from '@/lib/db'
import FinanceDashboard from '@/components/finance/FinanceDashboard'

export const dynamic = 'force-dynamic'

export default async function FinanceExcelPage() {
  const user = await prisma.user.findFirst()
  if (!user) return <div style={{ color: '#FF453A', padding: 32 }}>No user found</div>
  return <FinanceDashboard userId={user.id} />
}
