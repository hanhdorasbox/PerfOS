'use client'
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import type { YearProjection } from '@/lib/reality/calc'
import { formatCZK, formatCZKCompact } from '@/lib/reality/format'

export default function ProjectionChart({ projection }: { projection: YearProjection[] }) {
  const data = projection.map((p) => ({
    rok: p.year,
    Hodnota: Math.round(p.propertyValue),
    Úvěr: Math.round(p.loanBalance),
    'Vlastní kapitál': Math.round(p.equity),
    'Kum. cash flow': Math.round(p.cumulativeCashFlow),
  }))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="reEquity" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7FD5AA" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#7FD5AA" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis
          dataKey="rok"
          tick={{ fontSize: 10, fill: '#6E6E73' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}. rok`}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#6E6E73' }}
          axisLine={false}
          tickLine={false}
          width={52}
          tickFormatter={(v) => formatCZKCompact(v)}
        />
        <Tooltip
          contentStyle={{
            background: '#141418',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            fontSize: 12,
            color: '#EEEEF2',
          }}
          labelFormatter={(v) => `${v}. rok`}
          formatter={(value) => formatCZK(Number(value))}
        />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} iconType="plainline" />
        <Area
          type="monotone"
          dataKey="Vlastní kapitál"
          stroke="#7FD5AA"
          strokeWidth={2}
          fill="url(#reEquity)"
        />
        <Line type="monotone" dataKey="Hodnota" stroke="#c9a961" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="Úvěr" stroke="#E8907A" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
        <Line type="monotone" dataKey="Kum. cash flow" stroke="#B8A4FF" strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
