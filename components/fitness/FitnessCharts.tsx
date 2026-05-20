'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface FitnessLog { date: string; weight: number | null; waist: number | null }

export default function FitnessCharts({ fitnessLogs }: { fitnessLogs: FitnessLog[] }) {
  const data = fitnessLogs.map(l => ({
    date: new Date(l.date).toLocaleDateString('cs-CZ', { month: 'short', day: 'numeric' }),
    weight: l.weight,
    waist: l.waist,
  }))

  const tooltipStyle = { background: '#0A0A0B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '12px', color: '#FAFAFA' }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
      <div className="card">
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#76746E', marginBottom: '14px' }}>Weight (kg)</div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#76746E' }} axisLine={false} tickLine={false} />
            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#76746E' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="weight" stroke="#B4A7E5" strokeWidth={2} dot={{ fill: '#B4A7E5', r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="card">
        <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#76746E', marginBottom: '14px' }}>Waist (cm)</div>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#76746E' }} axisLine={false} tickLine={false} />
            <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#76746E' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="waist" stroke="#6BE3A4" strokeWidth={2} dot={{ fill: '#6BE3A4', r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
