import { Suspense } from 'react'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { Skeleton } from '@/components/ui/skeleton'
import { AgentsRegistry } from '@/components/agents/agents-registry'
import type { Agent } from '@/lib/database.types'
import type { AgentStatsSummary } from '@/components/agents/agent-card'

interface RawAgentStats {
  agent_id: string
  total_work_orders: number
  completed_work_orders: number
  failed_work_orders: number
  avg_duration_ms: number | null
  total_tokens_input: number
  total_tokens_output: number
  total_cost: number
}

interface RawSkillStat {
  agent_id: string
  skill_name: string
  usage_count: number
}

async function fetchData() {
  const supabase = createSupabaseServiceClient()

  const [
    { data: agents },
    { data: stats },
    { data: skills },
    { data: repos },
  ] = await Promise.all([
    supabase.from('agents').select('*').order('created_at', { ascending: false }),
    supabase.from('agent_stats').select('*'),
    supabase.from('skill_stats').select('*'),
    supabase.from('agent_repos').select('agent_id'),
  ])

  const repoCounts: Record<string, number> = {}
  for (const r of (repos ?? []) as unknown as Array<{ agent_id: string | null }>) {
    if (r.agent_id) repoCounts[r.agent_id] = (repoCounts[r.agent_id] ?? 0) + 1
  }

  const statsMap: Record<string, AgentStatsSummary> = {}
  for (const s of (stats ?? []) as unknown as RawAgentStats[]) {
    if (s.agent_id) statsMap[s.agent_id] = s
  }

  const skillsMap: Record<string, string[]> = {}
  for (const s of (skills ?? []) as unknown as RawSkillStat[]) {
    if (!s.agent_id) continue
    if (!skillsMap[s.agent_id]) skillsMap[s.agent_id] = []
    if (skillsMap[s.agent_id].length < 3) skillsMap[s.agent_id].push(s.skill_name)
  }

  return { agents: (agents ?? []) as Agent[], statsMap, skillsMap, repoCounts }
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-14 ml-auto" />
            </div>
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-28" />
            <div className="grid grid-cols-3 gap-2 pt-1">
              {Array.from({ length: 3 }).map((_, j) => (
                <Skeleton key={j} className="h-10 w-full rounded-md" />
              ))}
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

async function AgentsContent() {
  const { agents, statsMap, skillsMap, repoCounts } = await fetchData()
  return (
    <AgentsRegistry
      agents={agents}
      statsMap={statsMap}
      skillsMap={skillsMap}
      repoCounts={repoCounts}
    />
  )
}

export default function AgentsPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Agents</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage and monitor your registered agents
        </p>
      </div>

      <Suspense fallback={<LoadingSkeleton />}>
        <AgentsContent />
      </Suspense>
    </div>
  )
}
