'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface FitnessLog { date: string; waist: number | null; hip: number | null }

export default function FitnessCharts({ fitnessLogs }: { fitnessLogs: FitnessLog[] }) {
  const data = fitnessLogs.map(l => ({
    date: new Date(l.date).toLocaleDateString('cs-CZ', { month: 'short', day: 'numeric' }),
    waist: l.waist,
    hip: l.hip,
  }))

  const hasHip = fitnessLogs.some(l => l.hip != null)
  const tooltipStyle = { background: '#0A0A0B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px', color: '#F5F5F7' }

  return (
    <div className="mob-1col" style={{ display: 'grid', gridTemplateColumns: hasHip ? '1fr 1fr' : '1fr', gap: '16px' }}>
      <div className="card">
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: '14px' }}>Waist (cm)</div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6E6E73' }} axisLine={false} tickLine={false} />
            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#6E6E73' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="waist" stroke="#64f0aa" strokeWidth={2} dot={{ fill: '#64f0aa', r: 3 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {hasHip && (
        <div className="card">
          <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6E6E73', marginBottom: '14px' }}>Hip (cm)</div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6E6E73' }} axisLine={false} tickLine={false} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#6E6E73' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="hip" stroke="#a085ff" strokeWidth={2} dot={{ fill: '#a085ff', r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
