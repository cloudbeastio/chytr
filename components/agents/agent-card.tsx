'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { Agent, AgentStatus } from '@/lib/database.types'

export interface AgentStatsSummary {
  total_work_orders: number
  completed_work_orders: number
  failed_work_orders: number
  avg_duration_ms: number | null
  total_tokens_input: number
  total_tokens_output: number
  total_cost: number
}

interface AgentCardProps {
  agent: Agent
  stats: AgentStatsSummary | null
  skills: string[]
  repoCount: number
  onSelect: (agent: Agent) => void
}

const STATUS_CONFIG: Record<AgentStatus, { dot: string; label: string }> = {
  active: { dot: 'bg-green-500', label: 'Active' },
  idle: { dot: 'bg-yellow-400', label: 'Idle' },
  offline: { dot: 'bg-muted-foreground/50', label: 'Offline' },
  error: { dot: 'bg-red-500', label: 'Error' },
}

function formatDuration(ms: number | null): string {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

function formatCost(cost: number): string {
  if (cost === 0) return '$0.00'
  if (cost < 0.001) return '<$0.001'
  return `$${cost.toFixed(3)}`
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function AgentCard({ agent, stats, skills, repoCount, onSelect }: AgentCardProps) {
  const statusCfg = STATUS_CONFIG[agent.status] ?? STATUS_CONFIG.offline
  const total = stats?.total_work_orders ?? 0
  const completed = stats?.completed_work_orders ?? 0
  const failed = stats?.failed_work_orders ?? 0

  return (
    <Card
      className="cursor-pointer hover:border-primary/50 transition-colors"
      onClick={() => onSelect(agent)}
    >
      <CardHeader className="pb-3 space-y-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className={cn(
                      'inline-block w-2 h-2 rounded-full shrink-0 mt-0.5',
                      statusCfg.dot
                    )}
                  />
                </TooltipTrigger>
                <TooltipContent>{statusCfg.label}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="font-medium text-sm truncate">{agent.name}</span>
          </div>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 capitalize">
            {agent.type ?? 'unknown'}
          </Badge>
        </div>
        {agent.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1.5">{agent.description}</p>
        )}
        <p className="text-[10px] text-muted-foreground mt-1.5">
          Heartbeat: {formatTimeAgo(agent.last_heartbeat)}
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-md bg-muted/40 px-2 py-2">
            <p className="text-xs font-semibold">{total}</p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </div>
          <div className="rounded-md bg-muted/40 px-2 py-2">
            <p className="text-xs font-semibold text-green-400">{completed}</p>
            <p className="text-[10px] text-muted-foreground">Done</p>
          </div>
          <div className="rounded-md bg-muted/40 px-2 py-2">
            <p className="text-xs font-semibold text-red-400">{failed}</p>
            <p className="text-[10px] text-muted-foreground">Failed</p>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Avg {formatDuration(stats?.avg_duration_ms ?? null)}</span>
          <span>{formatCost(stats?.total_cost ?? 0)}</span>
          <span>
            {repoCount} repo{repoCount !== 1 ? 's' : ''}
          </span>
        </div>

        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {skills.map((s) => (
              <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0">
                {s}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
