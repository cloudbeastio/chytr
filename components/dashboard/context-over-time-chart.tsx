'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export interface ContextTimeSeriesPoint {
  date: string
  context_tokens: number
  count: number
}

interface ContextOverTimeChartProps {
  data: ContextTimeSeriesPoint[]
}

export function ContextOverTimeChart({ data }: ContextOverTimeChartProps) {
  if (!data.length) return null

  const displayData = data.map((d) => ({
    date: d.date,
    context_tokens: d.context_tokens,
    count: d.count,
  }))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Context load over time</CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Sum of context window tokens from preCompact events (proxy for model load)
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={displayData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => {
                  const d = new Date(v)
                  return `${d.getMonth() + 1}/${d.getDate()}`
                }}
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                labelFormatter={(v) => new Date(v).toLocaleDateString()}
                formatter={(value: number | undefined) => [value ?? 0, 'Context tokens']}
              />
              <Area
                type="monotone"
                dataKey="context_tokens"
                stroke="hsl(217 91% 60%)"
                fill="hsl(217 91% 60%)"
                fillOpacity={0.6}
                name="Context tokens"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
