import { createSupabaseServerClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ExecutionLog } from '@/components/trace/execution-log'
import { cn } from '@/lib/utils'
import {
  ChevronLeft,
  ExternalLink,
  GitBranch,
  Clock,
  Bot,
  Database,
  FileEdit,
  BookOpen,
  CheckSquare,
  Square,
  Coins,
} from 'lucide-react'
import type { WorkOrder, AgentLog, WorkOrderStatus, WorkOrderSource } from '@/lib/database.types'

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

type WorkOrderDetail = WorkOrder & {
  agents: { name: string } | null
  agent_repos: { repo_url: string } | null
}

type WorkOrderLine = {
  title: string
  description?: string
  completed?: boolean
}

type PayloadRecord = Record<string, unknown>

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
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function repoShortName(url: string): string {
  try {
    const parts = url.replace(/\.git$/, '').split('/')
    return parts.slice(-2).join('/')
  } catch {
    return url
  }
}

function aggregateFileEdits(
  logs: AgentLog[]
): Map<string, { added: number; removed: number }> {
  const map = new Map<string, { added: number; removed: number }>()
  for (const log of logs) {
    if (log.event_type !== 'file_edit') continue
    const p = (log.payload ?? {}) as PayloadRecord
    const path = String(p.file_path ?? '')
    if (!path) continue
    const existing = map.get(path) ?? { added: 0, removed: 0 }
    map.set(path, {
      added: existing.added + (typeof p.lines_added === 'number' ? p.lines_added : 0),
      removed: existing.removed + (typeof p.lines_removed === 'number' ? p.lines_removed : 0),
    })
  }
  return map
}

function aggregateSkills(logs: AgentLog[]): string[] {
  const seen = new Set<string>()
  for (const log of logs) {
    if (log.event_type !== 'skill_load') continue
    const p = (log.payload ?? {}) as PayloadRecord
    const name = String(p.skill_name ?? p.name ?? '')
    if (name) seen.add(name)
  }
  return [...seen]
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function WorkOrderDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()

  const { data: woData, error } = await supabase
    .from('work_orders')
    .select('*, agents!agent_id(name), agent_repos!repo_id(repo_url)')
    .eq('id', id)
    .single()

  if (error || !woData) notFound()

  const wo = woData as WorkOrderDetail
  const isRunning = wo.status === 'running' || wo.status === 'pending'

  const { data: logsData } = await supabase
    .from('agent_logs')
    .select('*')
    .eq('work_order_id', id)
    .order('sequence_number', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
    .limit(2000)

  const initialLogs = (logsData ?? []) as AgentLog[]

  const lines = Array.isArray(wo.lines) ? (wo.lines as WorkOrderLine[]) : null
  const fileChanges = aggregateFileEdits(initialLogs)
  const skills = aggregateSkills(initialLogs)
  const totalTokens = (wo.tokens_input ?? 0) + (wo.tokens_output ?? 0)

  const liveDurationMs =
    wo.duration_ms ??
    (wo.finished_at
      ? new Date(wo.finished_at).getTime() - new Date(wo.created_at).getTime()
      : isRunning
        ? Date.now() - new Date(wo.created_at).getTime()
        : null)

  return (
    <div className="flex flex-col -m-6 h-[calc(100vh-56px)]">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 shrink-0 space-y-3">
        <Link
          href="/work-orders"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Work Orders
        </Link>

        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold tracking-tight leading-snug truncate">
              {wo.objective ?? <span className="text-muted-foreground italic">No objective</span>}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
              {wo.agents?.name && (
                <span className="flex items-center gap-1">
                  <Bot className="h-3.5 w-3.5" />
                  {wo.agents.name}
                </span>
              )}
              {wo.agent_repos?.repo_url && (
                <span className="flex items-center gap-1">
                  <Database className="h-3.5 w-3.5" />
                  <span className="font-mono">{repoShortName(wo.agent_repos.repo_url)}</span>
                </span>
              )}
              {wo.branch_name && (
                <span className="flex items-center gap-1">
                  <GitBranch className="h-3.5 w-3.5" />
                  <span className="font-mono">{wo.branch_name}</span>
                </span>
              )}
              {wo.pr_url && (
                <a
                  href={wo.pr_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-primary hover:underline underline-offset-2"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  PR
                </a>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatDuration(liveDurationMs)}
              </span>
              <span className="flex items-center gap-1">
                <Coins className="h-3.5 w-3.5" />
                {formatTokens(totalTokens)} tokens
                {wo.total_cost > 0 && (
                  <span className="text-muted-foreground/60">
                    {' '}· ${wo.total_cost.toFixed(4)}
                  </span>
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge
              variant="outline"
              className={cn('text-xs px-2', SOURCE_CLASSES[wo.source])}
            >
              {wo.source}
            </Badge>
            <Badge
              variant="outline"
              className={cn('text-xs px-2', STATUS_CLASSES[wo.status])}
            >
              {STATUS_LABELS[wo.status]}
            </Badge>
          </div>
        </div>
      </div>

      <Separator />

      {/* Body: execution log + sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: execution log (2/3) */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-border">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0">
            <span className="text-xs font-medium text-muted-foreground">Execution Log</span>
            <span className="text-xs text-muted-foreground">{initialLogs.length} events</span>
          </div>
          <div className="flex-1 overflow-hidden">
            <ExecutionLog
              workOrderId={id}
              initialLogs={initialLogs}
              isRunning={isRunning}
            />
          </div>
        </div>

        {/* Right: sidebar (1/3) */}
        <div className="w-72 shrink-0 overflow-y-auto">
          <div className="p-4 space-y-5">

            {/* Work order lines */}
            {lines && lines.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  Objectives
                </h3>
                <div className="space-y-1.5">
                  {lines.map((line, i) => (
                    <div key={i} className="flex items-start gap-2">
                      {line.completed ? (
                        <CheckSquare className="h-4 w-4 text-green-400 mt-0.5 shrink-0" />
                      ) : (
                        <Square className="h-4 w-4 text-muted-foreground/40 mt-0.5 shrink-0" />
                      )}
                      <span
                        className={cn(
                          'text-sm leading-snug',
                          line.completed ? 'text-muted-foreground line-through' : 'text-foreground'
                        )}
                      >
                        {line.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {lines && lines.length > 0 && <Separator />}

            {/* Token usage */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Token Usage
              </h3>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Input</span>
                  <span className="font-mono tabular-nums">{formatTokens(wo.tokens_input ?? 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Output</span>
                  <span className="font-mono tabular-nums">{formatTokens(wo.tokens_output ?? 0)}</span>
                </div>
                <Separator className="my-1" />
                <div className="flex justify-between font-medium">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-mono tabular-nums">{formatTokens(totalTokens)}</span>
                </div>
                {wo.total_cost > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cost</span>
                    <span className="font-mono tabular-nums text-green-400">
                      ${wo.total_cost.toFixed(4)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* File changes */}
            {fileChanges.size > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    File Changes
                  </h3>
                  <div className="space-y-1">
                    {[...fileChanges.entries()].map(([path, { added, removed }]) => (
                      <div key={path} className="flex items-center gap-2">
                        <FileEdit className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                        <span className="flex-1 text-xs font-mono text-muted-foreground truncate">
                          {path.split('/').pop() ?? path}
                        </span>
                        <div className="flex items-center gap-1 font-mono text-[11px] shrink-0">
                          {added > 0 && <span className="text-green-400">+{added}</span>}
                          {removed > 0 && <span className="text-red-400">-{removed}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Skills loaded */}
            {skills.length > 0 && (
              <>
                <Separator />
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                    Skills Loaded
                  </h3>
                  <div className="space-y-1">
                    {skills.map((skill) => (
                      <div key={skill} className="flex items-center gap-2">
                        <BookOpen className="h-3.5 w-3.5 text-orange-400 shrink-0" />
                        <span className="text-xs text-muted-foreground truncate">{skill}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
