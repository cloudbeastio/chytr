import { createSupabaseServerClient } from '@/lib/supabase'
import { loadLicenseFromDB } from '@/lib/license-server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Suspense } from 'react'
import Link from 'next/link'
import {
  ClipboardList,
  Bot,
  Zap,
  CheckCircle,
  Clock,
  Brain,
  Lock,
  GitBranch,
} from 'lucide-react'
import type { WorkOrderStatus, AgentStatus } from '@/lib/database.types'
import {
  getBoundsFromRange,
  formatRangeLabel,
  type DashboardRange,
} from '@/lib/dashboard-utils'
import { TimeRangePicker } from '@/components/dashboard/time-range-picker'
import { AgentFleet } from '@/components/dashboard/agent-fleet'
import { Leaderboards } from '@/components/dashboard/leaderboards'
import { TokenUsage } from '@/components/dashboard/token-usage'
import { LogUsageChart } from '@/components/dashboard/log-usage-chart'

const STATUS_BADGE: Record<
  WorkOrderStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  pending: { label: 'Pending', variant: 'secondary' },
  running: { label: 'Running', variant: 'default' },
  completed: { label: 'Completed', variant: 'outline' },
  failed: { label: 'Failed', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'secondary' },
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function formatDuration(ms: number | null): string {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

interface DashboardData {
  workOrdersInRange: number
  activeAgents: number
  toolCallsInRange: number
  pendingApprovals: number
  knowledgeCount: number
  knowledgeLimit: number
  hasKnowledgeFeature: boolean
  pipeline: Record<WorkOrderStatus, number>
  fleet: Array<{
    id: string
    name: string
    status: AgentStatus
    type: string | null
    last_heartbeat: string | null
    running: number
    completed: number
    failed: number
  }>
  topAgents: Array<{ name: string; value: number }>
  topTools: Array<{ name: string; value: number }>
  topSkills: Array<{ name: string; value: number }>
  tokensIn: number
  tokensOut: number
  totalCost: number
  topRepos: Array<{ name: string; value: number }>
  topAgentActions: Array<{ name: string; value: number }>
  topCommands: Array<{ name: string; value: number }>
  logTimeSeries: Array<{ date: string; total: number; [k: string]: string | number }>
  eventTypes: string[]
  activeRepos: Array<{ source_repo: string; source_repo_name: string; log_count: number }>
  recentWorkOrders: Array<{
    id: string
    objective: string | null
    status: WorkOrderStatus
    created_at: string
    agent_id: string | null
    agent_name: string | null
    summary: string | null
    error_message: string | null
    duration_ms: number | null
  }>
}

async function fetchDashboardData(
  start: Date,
  end: Date
): Promise<DashboardData> {
  const supabase = await createSupabaseServerClient()
  const startStr = start.toISOString()
  const endStr = end.toISOString()

  const [
    woCountRes,
    activeAgentsRes,
    toolCallsRes,
    pendingApprovalsRes,
    knowledgeRes,
    licenseRes,
    pipelineRes,
    agentStatsRes,
    agentsRes,
    woRangeRes,
    logsRes,
    tokenSumsRes,
    recentRes,
    repoLogsRes,
    logsForChartRes,
  ] = await Promise.all([
    supabase
      .from('work_orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startStr)
      .lte('created_at', endStr),
    supabase
      .from('agents')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase
      .from('agent_logs')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'tool_call')
      .gte('created_at', startStr)
      .lte('created_at', endStr),
    supabase
      .from('approvals')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase.from('knowledge').select('*', { count: 'exact', head: true }),
    loadLicenseFromDB(),
    supabase
      .from('work_orders')
      .select('status')
      .gte('created_at', startStr)
      .lte('created_at', endStr),
    supabase.from('agent_stats').select('*'),
    supabase.from('agents').select('id, type'),
    supabase
      .from('work_orders')
      .select('agent_id')
      .gte('created_at', startStr)
      .lte('created_at', endStr),
    supabase
      .from('agent_logs')
      .select('event_type, payload')
      .in('event_type', ['tool_call', 'skill_load'])
      .gte('created_at', startStr)
      .lte('created_at', endStr)
      .limit(3000),
    supabase
      .from('work_orders')
      .select('tokens_input, tokens_output, total_cost')
      .gte('created_at', startStr)
      .lte('created_at', endStr),
    supabase
      .from('work_orders')
      .select(
        'id, objective, status, created_at, agent_id, summary, error_message, duration_ms'
      )
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('agent_logs')
      .select('source_repo, source_repo_name')
      .not('source_repo', 'is', null)
      .gte('created_at', startStr)
      .lte('created_at', endStr)
      .limit(5000),
    supabase
      .from('agent_logs')
      .select('event_type, created_at, payload')
      .gte('created_at', startStr)
      .lte('created_at', endStr)
      .limit(8000),
  ])

  const license = licenseRes ?? null
  const hasKnowledgeFeature = (license?.features ?? []).includes('knowledge')
  const knowledgeLimit = license?.limits?.knowledge_entries ?? 500

  const pipelineRows = (pipelineRes.data ?? []) as Array<{ status: WorkOrderStatus }>
  const pipeline: Record<WorkOrderStatus, number> = {
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
  }
  for (const row of pipelineRows) {
    if (row.status in pipeline) pipeline[row.status]++
  }

  const statsRows = (agentStatsRes.data ?? []) as Array<{
    agent_id: string
    name: string
    status: string
    last_heartbeat: string | null
    running: number
    completed: number
    failed: number
  }>
  const agentsRows = (agentsRes.data ?? []) as Array<{ id: string; type: string | null }>
  const typeByAgentId: Record<string, string | null> = {}
  for (const a of agentsRows) typeByAgentId[a.id] = a.type ?? null

  const fleet = statsRows.map((s) => ({
    id: s.agent_id,
    name: s.name,
    status: s.status as AgentStatus,
    type: typeByAgentId[s.agent_id] ?? null,
    last_heartbeat: s.last_heartbeat,
    running: Number(s.running) || 0,
    completed: Number(s.completed) || 0,
    failed: Number(s.failed) || 0,
  }))

  const woRangeRows = (woRangeRes.data ?? []) as Array<{ agent_id: string | null }>
  const agentRunCount: Record<string, number> = {}
  for (const row of woRangeRows) {
    const id = row.agent_id ?? '_unknown'
    agentRunCount[id] = (agentRunCount[id] ?? 0) + 1
  }
  const agentIdsByRuns = Object.entries(agentRunCount)
    .filter(([k]) => k !== '_unknown')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
  const topAgents: Array<{ name: string; value: number }> = agentIdsByRuns.map(
    ([id, value]) => {
      const agent = statsRows.find((s) => s.agent_id === id)
      return { name: agent?.name ?? id.slice(0, 8), value }
    }
  )

  const logsRows = (logsRes.data ?? []) as Array<{
    event_type: string
    payload: Record<string, unknown>
  }>
  const toolCount: Record<string, number> = {}
  const skillCount: Record<string, number> = {}
  for (const row of logsRows) {
    if (row.event_type === 'tool_call') {
      const name = (row.payload?.tool_name as string) ?? 'unknown'
      toolCount[name] = (toolCount[name] ?? 0) + 1
    } else if (row.event_type === 'skill_load') {
      const name = (row.payload?.skill_name as string) ?? 'unknown'
      skillCount[name] = (skillCount[name] ?? 0) + 1
    }
  }
  const topTools = Object.entries(toolCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }))
  const topSkills = Object.entries(skillCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }))

  let tokensIn = 0
  let tokensOut = 0
  let totalCost = 0
  const tokenRows = (tokenSumsRes.data ?? []) as Array<{
    tokens_input: number
    tokens_output: number
    total_cost: number
  }>
  for (const row of tokenRows) {
    tokensIn += Number(row.tokens_input) || 0
    tokensOut += Number(row.tokens_output) || 0
    totalCost += Number(row.total_cost) || 0
  }

  const repoLogRows = (repoLogsRes.data ?? []) as Array<{
    source_repo: string | null
    source_repo_name: string | null
  }>
  const repoCounts: Record<string, { name: string; count: number }> = {}
  for (const row of repoLogRows) {
    if (row.source_repo) {
      const key = row.source_repo
      if (!repoCounts[key]) {
        repoCounts[key] = { name: row.source_repo_name ?? key, count: 0 }
      }
      repoCounts[key].count++
    }
  }
  const activeRepos = Object.entries(repoCounts)
    .map(([url, { name, count }]) => ({ source_repo: url, source_repo_name: name, log_count: count }))
    .sort((a, b) => b.log_count - a.log_count)
    .slice(0, 10)

  const topRepos = activeRepos.slice(0, 5).map((r) => ({
    name: r.source_repo_name || r.source_repo,
    value: r.log_count,
  }))

  const logsAllRows = (logsForChartRes.data ?? []) as Array<{
    event_type: string
    created_at: string
    payload: Record<string, unknown>
  }>

  const eventTypeCount: Record<string, number> = {}
  const commandCount: Record<string, number> = {}
  const bucket: Record<string, Record<string, number>> = {}

  function dayKey(d: Date): string {
    return d.toISOString().slice(0, 10)
  }
  for (let t = new Date(start.getTime()); t <= end; t.setDate(t.getDate() + 1)) {
    bucket[dayKey(t)] = {}
  }

  for (const row of logsAllRows) {
    const et = row.event_type
    eventTypeCount[et] = (eventTypeCount[et] ?? 0) + 1
    const day = row.created_at.slice(0, 10)
    if (bucket[day]) {
      bucket[day][et] = (bucket[day][et] ?? 0) + 1
    }
    if (et === 'shell_execution') {
      const cmd = (row.payload?.command as string) ?? (row.payload?.cmd as string) ?? ''
      const label = cmd.length > 40 ? cmd.slice(0, 40) + '…' : cmd || '(empty)'
      commandCount[label] = (commandCount[label] ?? 0) + 1
    }
  }

  const topAgentActions = Object.entries(eventTypeCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({ name: name.replace(/_/g, ' '), value }))

  const topCommands = Object.entries(commandCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value]) => ({ name, value }))

  const eventTypes = Object.keys(eventTypeCount).sort()
  const logTimeSeries = Object.entries(bucket)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, counts]) => {
      const total = Object.values(counts).reduce((s, n) => s + n, 0)
      return { date, ...counts, total }
    })

  const recentRows = (recentRes.data ?? []) as Array<{
    id: string
    objective: string | null
    status: WorkOrderStatus
    created_at: string
    agent_id: string | null
    summary: string | null
    error_message: string | null
    duration_ms: number | null
  }>
  const agentIds = [...new Set(recentRows.map((r) => r.agent_id).filter(Boolean))] as string[]
  let agentNames: Record<string, string> = {}
  if (agentIds.length > 0) {
    const { data: agentsData } = await supabase
      .from('agents')
      .select('id, name')
      .in('id', agentIds)
    const list = (agentsData ?? []) as Array<{ id: string; name: string }>
    agentNames = Object.fromEntries(list.map((a) => [a.id, a.name]))
  }
  const recentWorkOrders = recentRows.map((wo) => ({
    ...wo,
    agent_name: (wo.agent_id && agentNames[wo.agent_id]) ?? null,
  }))

  return {
    workOrdersInRange: woCountRes.count ?? 0,
    activeAgents: activeAgentsRes.count ?? 0,
    toolCallsInRange: toolCallsRes.count ?? 0,
    pendingApprovals: pendingApprovalsRes.count ?? 0,
    knowledgeCount: knowledgeRes.count ?? 0,
    knowledgeLimit,
    hasKnowledgeFeature,
    pipeline,
    fleet,
    topAgents,
    topTools,
    topSkills,
    tokensIn,
    tokensOut,
    totalCost,
    topRepos,
    topAgentActions,
    topCommands,
    logTimeSeries,
    eventTypes,
    activeRepos,
    recentWorkOrders,
  }
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-1" />
            <Skeleton className="h-3 w-28" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function PipelineBar({ pipeline }: { pipeline: Record<WorkOrderStatus, number> }) {
  const total =
    pipeline.pending +
    pipeline.running +
    pipeline.completed +
    pipeline.failed +
    pipeline.cancelled
  if (total === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pipeline</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Work order status breakdown in selected range
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No work orders in range</p>
        </CardContent>
      </Card>
    )
  }
  const pct = (n: number) => (total > 0 ? (n / total) * 100 : 0)
  const segments = [
    { status: 'pending' as const, count: pipeline.pending, color: 'bg-amber-500/70' },
    { status: 'running' as const, count: pipeline.running, color: 'bg-blue-500/70' },
    { status: 'completed' as const, count: pipeline.completed, color: 'bg-green-500/70' },
    { status: 'failed' as const, count: pipeline.failed, color: 'bg-red-500/70' },
    { status: 'cancelled' as const, count: pipeline.cancelled, color: 'bg-muted-foreground/50' },
  ]
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Pipeline</CardTitle>
          <span className="text-xs text-muted-foreground">{total} in range</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Work order status breakdown in selected range (pending → running → completed / failed / cancelled)
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-2 rounded-full bg-muted overflow-hidden flex">
          {segments.map((s) =>
            pct(s.count) > 0 ? (
              <div
                key={s.status}
                className={s.color}
                style={{ width: `${pct(s.count)}%` }}
              />
            ) : null
          )}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
          {segments.map(
            (s) =>
              s.count > 0 && (
                <span key={s.status}>
                  {STATUS_BADGE[s.status].label}: {s.count}
                </span>
              )
          )}
        </div>
      </CardContent>
    </Card>
  )
}

interface DashboardContentProps {
  range: DashboardRange
  from?: string
  to?: string
}

async function DashboardContent({ range, from, to }: DashboardContentProps) {
  const bounds = getBoundsFromRange(
    range,
    from,
    to
  )
  const data = await fetchDashboardData(bounds.start, bounds.end)

  const stats = [
    {
      label: 'Work Orders',
      value: data.workOrdersInRange,
      icon: ClipboardList,
      description: 'In selected range',
    },
    {
      label: 'Active Agents',
      value: data.activeAgents,
      icon: Bot,
      description: 'Currently online',
    },
    {
      label: 'Tool Calls',
      value: data.toolCallsInRange,
      icon: Zap,
      description: 'In selected range',
    },
    {
      label: 'Pending Approvals',
      value: data.pendingApprovals,
      icon: CheckCircle,
      description: 'Awaiting review',
    },
    {
      label: 'Knowledge learned',
      value: data.knowledgeCount,
      icon: Brain,
      description: data.hasKnowledgeFeature
        ? `of ${data.knowledgeLimit.toLocaleString()} (Pro)`
        : 'Pro feature',
      isPremium: !data.hasKnowledgeFeature,
    },
  ]

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map(({ label, value, icon: Icon, description, isPremium }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {label}
              </CardTitle>
              {isPremium ? (
                <Lock className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Icon className="h-4 w-4 text-muted-foreground" />
              )}
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{value.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <PipelineBar pipeline={data.pipeline} />

      <div className="w-full">
        <Leaderboards
          topRepos={data.topRepos}
          topAgentActions={data.topAgentActions}
          topTools={data.topTools}
          topSkills={data.topSkills}
          topCommands={data.topCommands}
        />
      </div>

      <LogUsageChart data={data.logTimeSeries} eventTypes={data.eventTypes} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <AgentFleet agents={data.fleet} />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.recentWorkOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center px-6">
                  No work orders yet
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {data.recentWorkOrders.map((wo) => {
                    const badgeCfg = STATUS_BADGE[wo.status] ?? STATUS_BADGE.pending
                    return (
                      <Link
                        key={wo.id}
                        href={`/work-orders/${wo.id}`}
                        className="flex items-start gap-3 px-6 py-3 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">
                            {wo.objective ?? (
                              <span className="text-muted-foreground italic">No objective</span>
                            )}
                          </p>
                          {(wo.agent_name || wo.summary || wo.error_message) && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                              {wo.agent_name ? `${wo.agent_name} · ` : ''}
                              {wo.summary ?? wo.error_message ?? ''}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="text-xs text-muted-foreground">
                              {formatTimeAgo(new Date(wo.created_at))}
                              {wo.duration_ms != null && (
                                <> · {formatDuration(wo.duration_ms)}</>
                              )}
                            </span>
                          </div>
                        </div>
                        <Badge variant={badgeCfg.variant} className="shrink-0 mt-0.5">
                          {badgeCfg.label}
                        </Badge>
                      </Link>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        <div className="space-y-4">
          {data.activeRepos.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Active Repos</CardTitle>
                  <GitBranch className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.activeRepos.map((repo) => (
                  <div key={repo.source_repo} className="flex items-center justify-between gap-2">
                    <a
                      href={repo.source_repo}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-mono truncate hover:underline underline-offset-2"
                    >
                      {repo.source_repo_name}
                    </a>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                      {repo.log_count.toLocaleString()}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          <TokenUsage
            tokensIn={data.tokensIn}
            tokensOut={data.tokensOut}
            totalCost={data.totalCost}
          />
        </div>
      </div>
    </>
  )
}

interface PageProps {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams
  const range = (params.range === 'day' || params.range === 'week' || params.range === 'month' || params.range === 'custom'
    ? params.range
    : 'week') as DashboardRange
  const from = params.from
  const to = params.to

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {formatRangeLabel(range, from, to)} · Overview of your agent activity
          </p>
        </div>
        <TimeRangePicker range={range} from={from} to={to} />
      </div>

      <Suspense fallback={<StatsSkeleton />}>
        <DashboardContent range={range} from={from} to={to} />
      </Suspense>
    </div>
  )
}
