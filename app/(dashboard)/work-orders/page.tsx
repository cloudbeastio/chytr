import { createSupabaseServiceClient } from '@/lib/supabase'
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
import { WorkOrderFilters } from '@/components/work-orders/filters'
import { cn } from '@/lib/utils'
import { ClipboardList } from 'lucide-react'
import type { WorkOrder, WorkOrderStatus, WorkOrderSource } from '@/lib/database.types'

const STATUS_CLASSES: Record<WorkOrderStatus, string> = {
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  running: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  completed: 'bg-green-500/15 text-green-400 border-green-500/30',
  failed: 'bg-red-500/15 text-red-400 border-red-500/30',
  cancelled: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
}

const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
}

const SOURCE_CLASSES: Record<WorkOrderSource, string> = {
  cloud: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  local: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
  job: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
}

type WorkOrderRow = WorkOrder & {
  agents: { name: string } | null
  agent_repos: { repo_url: string } | null
}

function formatDuration(ms: number | null): string {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rs = s % 60
  if (m < 60) return rs > 0 ? `${m}m ${rs}s` : `${m}m`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`
}

function formatTokens(n: number): string {
  if (n === 0) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
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

function repoShortName(url: string): string {
  try {
    const parts = url.replace(/\.git$/, '').split('/')
    return parts.slice(-2).join('/')
  } catch {
    return url
  }
}

interface PageProps {
  searchParams: Promise<{ status?: string; source?: string }>
}

async function WorkOrderTable({
  status,
  source,
}: {
  status: string | undefined
  source: string | undefined
}) {
  const supabase = createSupabaseServiceClient()

  let query = supabase
    .from('work_orders')
    .select('*, agents!agent_id(name), agent_repos!repo_id(repo_url)')
    .order('created_at', { ascending: false })
    .limit(200)

  if (status) query = query.eq('status', status)
  if (source) query = query.eq('source', source)

  const { data, error } = await query

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive text-center">
        Failed to load work orders: {error.message}
      </div>
    )
  }

  const workOrders = (data ?? []) as WorkOrderRow[]

  if (workOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 gap-3">
        <ClipboardList className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">
          {status || source ? 'No work orders match these filters' : 'No work orders yet'}
        </p>
        {(status || source) && (
          <Link
            href="/work-orders"
            className="text-xs text-primary hover:underline underline-offset-2"
          >
            Clear filters
          </Link>
        )}
      </div>
    )
  }

  const workOrderIds = workOrders.map((wo) => wo.id)
  const { data: toolCallLogs } = await supabase
    .from('agent_logs')
    .select('work_order_id')
    .eq('event_type', 'tool_call')
    .in('work_order_id', workOrderIds)

  const toolCallCounts = (toolCallLogs as { work_order_id: string | null }[] ?? []).reduce<
    Record<string, number>
  >((acc, log) => {
    if (log.work_order_id) {
      acc[log.work_order_id] = (acc[log.work_order_id] ?? 0) + 1
    }
    return acc
  }, {})

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border">
            <TableHead className="text-xs font-medium">Objective</TableHead>
            <TableHead className="text-xs font-medium w-28">Status</TableHead>
            <TableHead className="text-xs font-medium w-24">Source</TableHead>
            <TableHead className="text-xs font-medium w-32">Agent</TableHead>
            <TableHead className="text-xs font-medium w-36">Repo</TableHead>
            <TableHead className="text-xs font-medium w-20 text-right">Duration</TableHead>
            <TableHead className="text-xs font-medium w-20 text-right">Tools</TableHead>
            <TableHead className="text-xs font-medium w-20 text-right">Tokens</TableHead>
            <TableHead className="text-xs font-medium w-24 text-right">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workOrders.map((wo) => {
            const totalTokens = (wo.tokens_input ?? 0) + (wo.tokens_output ?? 0)
            return (
              <TableRow
                key={wo.id}
                className="cursor-pointer hover:bg-accent/30 border-border"
              >
                <TableCell className="max-w-[240px]">
                  <Link href={`/work-orders/${wo.id}`} className="block">
                    <span className="text-sm truncate block">
                      {wo.objective ?? (
                        <span className="text-muted-foreground italic">No objective</span>
                      )}
                    </span>
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/work-orders/${wo.id}`} className="block">
                    <Badge
                      variant="outline"
                      className={cn('text-[11px] px-1.5 py-0', STATUS_CLASSES[wo.status])}
                    >
                      {STATUS_LABELS[wo.status]}
                    </Badge>
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/work-orders/${wo.id}`} className="block">
                    <Badge
                      variant="outline"
                      className={cn('text-[11px] px-1.5 py-0', SOURCE_CLASSES[wo.source])}
                    >
                      {wo.source}
                    </Badge>
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/work-orders/${wo.id}`} className="block">
                    <span className="text-sm text-muted-foreground truncate block">
                      {wo.agents?.name ?? '—'}
                    </span>
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/work-orders/${wo.id}`} className="block">
                    <span className="text-xs font-mono text-muted-foreground truncate block">
                      {wo.agent_repos?.repo_url
                        ? repoShortName(wo.agent_repos.repo_url)
                        : '—'}
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/work-orders/${wo.id}`} className="block">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatDuration(wo.duration_ms)}
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/work-orders/${wo.id}`} className="block">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {toolCallCounts[wo.id] ?? 0}
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/work-orders/${wo.id}`} className="block">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatTokens(totalTokens)}
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/work-orders/${wo.id}`} className="block">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatTimeAgo(new Date(wo.created_at))}
                    </span>
                  </Link>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

export default async function WorkOrdersPage({ searchParams }: PageProps) {
  const { status, source } = await searchParams

  return (
    <div className="space-y-5 max-w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Work Orders</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Agent task execution history</p>
        </div>
        <Suspense fallback={null}>
          <WorkOrderFilters />
        </Suspense>
      </div>

      <Suspense
        fallback={
          <div className="rounded-lg border border-border h-64 animate-pulse bg-muted/20" />
        }
      >
        <WorkOrderTable status={status} source={source} />
      </Suspense>
    </div>
  )
}
