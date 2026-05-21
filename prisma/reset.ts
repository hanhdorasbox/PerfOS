import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Clearing all sample data...')

  // Delete in dependency order
  await prisma.dailyBriefing.deleteMany()
  await prisma.careerCapitalGoalEval.deleteMany()
  await prisma.careerCapitalItem.deleteMany()
  await prisma.proofOfWork.deleteMany()
  await prisma.skill.deleteMany()
  await prisma.weeklyTask.deleteMany()
  await prisma.weeklyPlan.deleteMany()
  await prisma.progressUpdate.deleteMany()
  await prisma.milestone.deleteMany()
  await prisma.goal.deleteMany()
  await prisma.quarter.deleteMany()
  await prisma.longTermGoal.deleteMany()
  await prisma.workoutLog.deleteMany()
  await prisma.proteinLog.deleteMany()
  await prisma.fitnessLog.deleteMany()
  await prisma.aIConversation.deleteMany()
  await prisma.workItem.deleteMany()
  await prisma.antiDriftReport.deleteMany()
  await prisma.weeklyReport.deleteMany()
  await prisma.mealFeedback.deleteMany()
  await prisma.plannedMeal.deleteMany()
  await prisma.mealPlan.deleteMany()
  await prisma.foodPreference.deleteMany()
  await prisma.fitnessStrategy.deleteMany()
  await prisma.behaviorPattern.deleteMany()
  await prisma.transaction.deleteMany()
  await prisma.financialReport.deleteMany()
  await prisma.bankStatement.deleteMany()
  await prisma.transactionRule.deleteMany()
  await prisma.financeTransaction.deleteMany()
  await prisma.financeReport.deleteMany()
  await prisma.financeImport.deleteMany()
  await prisma.financeWorkbook.deleteMany()
  await prisma.financeCategorizationRule.deleteMany()
  await prisma.trajectoryQuarterPlan.deleteMany()
  await prisma.trajectoryGap.deleteMany()
  await prisma.careerTrajectory.deleteMany()
  await prisma.learningMilestone.deleteMany()
  await prisma.capabilityGoal.deleteMany()
  await prisma.idea.deleteMany()
  await prisma.googleCalendarToken.deleteMany()
  await prisma.user.deleteMany()

  // Create clean user (no sample data)
  const user = await prisma.user.create({
    data: { name: 'Hanh', email: 'hanh@example.com' }
  })

  console.log(`✅ Done. Clean user created: ${user.id}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
