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

export interface WOVolumePoint {
  date: string
  count: number
}

interface WOVolumeChartProps {
  data: WOVolumePoint[]
}

export function WOVolumeChart({ data }: WOVolumeChartProps) {
  if (!data.length) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Work orders per day</CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Volume of work orders started in selected range
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
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
                formatter={(value: number | undefined) => [value ?? 0, 'Work orders']}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="hsl(142 76% 36%)"
                fill="hsl(142 76% 36%)"
                fillOpacity={0.6}
                name="Work orders"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
