import { prisma } from '@/lib/db'
import CareerScorecard from '@/components/career/CareerScorecard'
import SkillTracker from '@/components/career/SkillTracker'
import ProofOfWorkTracker from '@/components/career/ProofOfWorkTracker'
import CareerCapitalItems from '@/components/career/CareerCapitalItems'
import GoalCapitalEvals from '@/components/career/GoalCapitalEvals'
import RoadmapGenerator from '@/components/career/RoadmapGenerator'

export const dynamic = 'force-dynamic'

export default async function CareerPage() {
  const user = await prisma.user.findFirst()
  if (!user) return <div>No user found</div>

  const quarter = await prisma.quarter.findFirst({
    where: { userId: user.id, status: 'active' },
    orderBy: { startDate: 'desc' }
  })

  const [skills, proofOfWork, careerItems, goals] = await Promise.all([
    prisma.skill.findMany({ where: { userId: user.id }, orderBy: { addedAt: 'desc' } }),
    prisma.proofOfWork.findMany({ where: { userId: user.id }, orderBy: { completedAt: 'desc' } }),
    prisma.careerCapitalItem.findMany({ where: { userId: user.id }, orderBy: { date: 'desc' } }),
    quarter
      ? prisma.goal.findMany({
          where: { quarterId: quarter.id },
          include: { careerCapitalEval: true }
        })
      : []
  ])

  return (
    <main className="animate-entrance" style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#F5F5F7' }}>Career Capital</h1>
        <p style={{ color: '#A1A1A6', fontSize: 14, marginTop: 4 }}>
          Am I becoming more valuable, differentiated, and harder to replace?
        </p>
      </div>

      <CareerScorecard
        skills={skills}
        proofOfWork={proofOfWork}
        goals={goals}
        quarterName={quarter?.name ?? 'Q2 2026'}
        userId={user.id}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
        <SkillTracker skills={skills} userId={user.id} />
        <ProofOfWorkTracker proofOfWork={proofOfWork} userId={user.id} />
      </div>

      <div style={{ marginTop: 20 }}>
        <CareerCapitalItems items={careerItems} userId={user.id} />
      </div>

      <div style={{ marginTop: 20 }}>
        <GoalCapitalEvals goals={goals} />
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Planning Sandbox</span>
          <span style={{ fontSize: 11, color: '#4A4845', padding: '2px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            Draft only — convert to a Learning Roadmap to make it operational
          </span>
        </div>
        <RoadmapGenerator userId={user.id} />
      </div>
    </main>
  )
}
