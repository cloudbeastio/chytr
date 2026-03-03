import { createSupabaseServerClient } from '@/lib/supabase'
import { Suspense } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Activity } from 'lucide-react'
import { ActivityRefreshButton } from '@/components/dashboard/activity-refresh-button'
import type { AgentLog, LogEventType } from '@/lib/database.types'

const EVENT_LABELS: Record<LogEventType, string> = {
  session_start: 'Session start',
  tool_call: 'Tool call',
  tool_result: 'Tool result',
  tool_failure: 'Tool failure',
  shell_execution: 'Shell execution',
  file_edit: 'File edit',
  mcp_execution: 'MCP execution',
  skill_load: 'Skill load',
  agent_thought: 'Agent thought',
  agent_response: 'Agent response',
  subagent_start: 'Subagent start',
  subagent_stop: 'Subagent stop',
  approval_requested: 'Approval requested',
  error: 'Error',
  session_end: 'Session end',
  pre_compact: 'Pre compact',
  stop: 'Stop',
}

const EVENT_VARIANT: Record<LogEventType, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  session_start: 'secondary',
  tool_call: 'default',
  tool_result: 'outline',
  tool_failure: 'destructive',
  shell_execution: 'default',
  file_edit: 'default',
  mcp_execution: 'default',
  skill_load: 'secondary',
  agent_thought: 'outline',
  agent_response: 'default',
  subagent_start: 'secondary',
  subagent_stop: 'secondary',
  approval_requested: 'default',
  error: 'destructive',
  session_end: 'secondary',
  pre_compact: 'outline',
  stop: 'secondary',
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

function payloadPreview(payload: unknown): string {
  if (payload == null) return '—'
  if (typeof payload === 'string') return payload.slice(0, 80)
  try {
    const s = JSON.stringify(payload)
    return s.length > 80 ? s.slice(0, 80) + '…' : s
  } catch {
    return '—'
  }
}

async function ActivityTable() {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('agent_logs')
    .select('id, chyt_id, agent_id, event_type, payload, sequence_number, source_repo_name, created_at')
    .order('created_at', { ascending: false }) // descending: newest first
    .limit(200)

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive text-center">
        Failed to load activity: {error.message}
      </div>
    )
  }

  const logs = (data ?? []) as AgentLog[]

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 gap-3">
        <Activity className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No agent logs yet</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border">
            <TableHead className="text-xs font-medium w-40">Time</TableHead>
            <TableHead className="text-xs font-medium w-36">Event</TableHead>
            <TableHead className="text-xs font-medium w-28">Work Order</TableHead>
            <TableHead className="text-xs font-medium w-24">Seq</TableHead>
            <TableHead className="text-xs font-medium min-w-0">Payload</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id} className="hover:bg-accent/30 border-border">
              <TableCell className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                {formatTimeAgo(new Date(log.created_at))}
              </TableCell>
              <TableCell>
                <Badge variant={EVENT_VARIANT[log.event_type]} className="text-[11px] px-1.5 py-0">
                  {EVENT_LABELS[log.event_type]}
                </Badge>
              </TableCell>
              <TableCell>
                {log.chyt_id ? (
                  <Link
                    href={`/chyts/${log.chyt_id}`}
                    className="text-xs text-primary hover:underline underline-offset-2 font-mono truncate block max-w-[140px]"
                  >
                    {log.chyt_id.slice(0, 8)}…
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground tabular-nums">
                {log.sequence_number ?? '—'}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground font-mono truncate max-w-[280px]">
                {payloadPreview(log.payload)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export default async function ActivityPage() {
  return (
    <div className="space-y-5 max-w-full">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Activity</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All agent log events (newest first)</p>
        </div>
        <ActivityRefreshButton />
      </div>

      <Suspense
        fallback={
          <div className="rounded-lg border border-border h-64 animate-pulse bg-muted/20" />
        }
      >
        <ActivityTable />
      </Suspense>
    </div>
  )
}
