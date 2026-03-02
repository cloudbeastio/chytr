'use client'

import { useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const EVENT_TYPE_COLORS: Record<string, string> = {
  session_start: 'hsl(142 76% 36%)',
  tool_call: 'hsl(217 91% 60%)',
  tool_result: 'hsl(217 91% 70%)',
  tool_failure: 'hsl(0 84% 60%)',
  shell_execution: 'hsl(262 83% 58%)',
  file_edit: 'hsl(47 96% 53%)',
  mcp_execution: 'hsl(173 80% 40%)',
  skill_load: 'hsl(280 67% 42%)',
  agent_thought: 'hsl(200 90% 50%)',
  agent_response: 'hsl(200 80% 45%)',
  subagent_start: 'hsl(30 90% 50%)',
  subagent_stop: 'hsl(30 80% 45%)',
  approval_requested: 'hsl(340 82% 52%)',
  error: 'hsl(0 72% 51%)',
  session_end: 'hsl(0 0% 45%)',
}

function formatEventTypeLabel(key: string): string {
  return key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export interface LogTimeSeriesPoint {
  date: string
  total: number
  [eventType: string]: string | number
}

interface LogUsageChartProps {
  data: LogTimeSeriesPoint[]
  eventTypes: string[]
}

export function LogUsageChart({ data, eventTypes }: LogUsageChartProps) {
  const [filterType, setFilterType] = useState<string | null>(null)

  if (!data.length) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Log usage over time</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-8 text-center">
            No log data in range
          </p>
        </CardContent>
      </Card>
    )
  }

  const typesToShow = filterType ? [filterType] : eventTypes
  const displayData = data.map((d) => {
    const out: Record<string, string | number> = { date: d.date }
    typesToShow.forEach((t) => {
      out[t] = d[t] ?? 0
    })
    out.total = typesToShow.reduce((sum, t) => sum + (Number(d[t]) || 0), 0)
    return out
  })

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base">Log usage over time</CardTitle>
          <div className="flex flex-wrap gap-1">
            <Button
              variant={filterType === null ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setFilterType(null)}
            >
              All
            </Button>
            {eventTypes.map((t) => (
              <Button
                key={t}
                variant={filterType === t ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setFilterType(t)}
              >
                {formatEventTypeLabel(t)}
              </Button>
            ))}
          </div>
        </div>
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
                formatter={(value: number | undefined, name: string | undefined) => [
                  value ?? 0,
                  name === 'total' ? 'Total' : formatEventTypeLabel(name ?? ''),
                ]}
              />
              {filterType === null && eventTypes.length > 1 && <Legend />}
              {typesToShow.map((t) => (
                <Area
                  key={t}
                  type="monotone"
                  dataKey={t}
                  stackId={filterType === null ? '1' : undefined}
                  stroke={EVENT_TYPE_COLORS[t] ?? 'hsl(var(--primary))'}
                  fill={EVENT_TYPE_COLORS[t] ?? 'hsl(var(--primary))'}
                  fillOpacity={filterType === null ? 0.6 : 0.8}
                  name={formatEventTypeLabel(t)}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
