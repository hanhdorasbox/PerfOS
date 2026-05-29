'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface Props {
  progressUpdates: { loggedAt: string; value: number }[]
  startDate: string
  deadline: string
  startValue: number | null
  targetValue: number | null
  trackingType: string
}

export default function GoalDetailChart({ progressUpdates, startDate, deadline, startValue, targetValue, trackingType }: Props) {
  const start = new Date(startDate).getTime()
  const end = new Date(deadline).getTime()
  const total = end - start

  const data = progressUpdates.map(u => {
    const elapsed = new Date(u.loggedAt).getTime() - start
    const expected = Math.min(100, Math.max(0, elapsed / total * 100))
    let actual = u.value
    if (trackingType === 'QUANTITATIVE' && startValue != null && targetValue != null) {
      actual = Math.min(100, Math.max(0, (u.value - startValue) / (targetValue - startValue) * 100))
    }
    return {
      date: new Date(u.loggedAt).toLocaleDateString('cs-CZ', { month: 'short', day: 'numeric' }),
      actual: Math.round(actual),
      expected: Math.round(expected),
    }
  })

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6E6E73' }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#6E6E73' }} axisLine={false} tickLine={false} unit="%" />
        <Tooltip contentStyle={{ background: '#0A0A0B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px', color: '#F5F5F7' }} />
        <Line type="monotone" dataKey="actual" stroke="#B8A4FF" strokeWidth={2.5} dot={{ fill: '#B8A4FF', r: 4 }} name="Actual" />
        <Line type="monotone" dataKey="expected" stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} strokeDasharray="4 4" dot={false} name="Expected" />
      </LineChart>
    </ResponsiveContainer>
  )
}
