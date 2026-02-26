'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import type { AgentLog } from '@/lib/database.types'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Play,
  Wrench,
  CheckCircle,
  AlertCircle,
  Terminal,
  FileEdit,
  Zap,
  BookOpen,
  Brain,
  MessageSquare,
  GitBranch,
  GitMerge,
  AlertTriangle,
  XCircle,
  CheckSquare,
  ChevronRight,
  ChevronDown,
  Loader2,
} from 'lucide-react'

interface Props {
  workOrderId: string
  initialLogs: AgentLog[]
  isRunning: boolean
}

type PayloadRecord = Record<string, unknown>

function getDurationBadgeClass(ms: number): string {
  if (ms < 1000) return 'bg-green-500/15 text-green-400 border-green-500/30'
  if (ms <= 5000) return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
  return 'bg-red-500/15 text-red-400 border-red-500/30'
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatElapsed(ms: number): string {
  if (ms < 1000) return `+${ms}ms`
  const s = Math.floor(ms / 1000)
  if (s < 60) return `+${s}s`
  const m = Math.floor(s / 60)
  const rs = s % 60
  return rs > 0 ? `+${m}m${rs}s` : `+${m}m`
}

function EventTimestamp({
  timeStr,
  elapsedStr,
}: {
  timeStr: string
  elapsedStr: string | null
}) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0 font-mono">
      {elapsedStr && <span className="text-muted-foreground/50">{elapsedStr}</span>}
      <span>{timeStr}</span>
    </div>
  )
}

function EventRow({ log, sessionStart }: { log: AgentLog; sessionStart: Date | null }) {
  const [expanded, setExpanded] = useState(false)
  const payload = ((log.payload ?? {}) as PayloadRecord)

  const ts = new Date(log.created_at)
  const elapsed = sessionStart ? ts.getTime() - sessionStart.getTime() : null
  const timeStr = ts.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const elapsedStr = elapsed !== null && elapsed >= 0 ? formatElapsed(elapsed) : null

  switch (log.event_type) {
    case 'session_start':
      return (
        <div className="flex items-center gap-3 py-2">
          <Play className="h-4 w-4 text-green-500 shrink-0" />
          <span className="text-sm text-green-400 font-medium flex-1">Session started</span>
          <EventTimestamp timeStr={timeStr} elapsedStr={null} />
        </div>
      )

    case 'tool_call': {
      const toolName = String(payload.tool_name ?? 'unknown')
      const durationMs = typeof payload.duration_ms === 'number' ? payload.duration_ms : null
      return (
        <div className="flex items-center gap-3 py-1.5">
          <Wrench className="h-4 w-4 text-blue-400 shrink-0" />
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="text-sm font-mono text-blue-300 truncate">{toolName}</span>
            {durationMs !== null && (
              <Badge
                variant="outline"
                className={cn('text-[10px] px-1.5 py-0 h-4 shrink-0', getDurationBadgeClass(durationMs))}
              >
                {formatMs(durationMs)}
              </Badge>
            )}
          </div>
          <EventTimestamp timeStr={timeStr} elapsedStr={elapsedStr} />
        </div>
      )
    }

    case 'tool_result': {
      const resultLength = typeof payload.result_length === 'number' ? payload.result_length : null
      return (
        <div className="flex items-center gap-3 py-1 pl-7">
          <CheckCircle className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
          <span className="flex-1 text-xs text-muted-foreground/60">
            Result{resultLength !== null ? ` · ${resultLength.toLocaleString()} chars` : ''}
          </span>
          <span className="text-[11px] text-muted-foreground/40 font-mono">{timeStr}</span>
        </div>
      )
    }

    case 'tool_failure': {
      const error = String(payload.error ?? payload.error_message ?? 'Unknown error')
      return (
        <div className="flex items-start gap-3 py-2 px-3 rounded-md bg-red-500/5 border border-red-500/20">
          <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-[11px] text-red-500/60 font-medium block">Tool failure</span>
            <span className="text-sm text-red-300 font-mono break-all">{error}</span>
          </div>
          <EventTimestamp timeStr={timeStr} elapsedStr={elapsedStr} />
        </div>
      )
    }

    case 'shell_execution': {
      const command = String(payload.command ?? '')
      const exitCode = typeof payload.exit_code === 'number' ? payload.exit_code : null
      return (
        <div className="flex items-center gap-3 py-1.5">
          <Terminal className="h-4 w-4 text-gray-400 shrink-0" />
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="text-sm font-mono text-gray-300 truncate">{command}</span>
            {exitCode !== null && (
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] px-1.5 py-0 h-4 shrink-0',
                  exitCode === 0
                    ? 'bg-green-500/15 text-green-400 border-green-500/30'
                    : 'bg-red-500/15 text-red-400 border-red-500/30'
                )}
              >
                exit {exitCode}
              </Badge>
            )}
          </div>
          <EventTimestamp timeStr={timeStr} elapsedStr={elapsedStr} />
        </div>
      )
    }

    case 'file_edit': {
      const filePath = String(payload.file_path ?? '')
      const linesAdded = typeof payload.lines_added === 'number' ? payload.lines_added : null
      const linesRemoved = typeof payload.lines_removed === 'number' ? payload.lines_removed : null
      return (
        <div className="flex items-center gap-3 py-1.5">
          <FileEdit className="h-4 w-4 text-purple-400 shrink-0" />
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="text-sm font-mono text-purple-300 truncate">{filePath}</span>
            <div className="flex items-center gap-1 shrink-0 font-mono text-[11px]">
              {linesAdded !== null && linesAdded > 0 && (
                <span className="text-green-400">+{linesAdded}</span>
              )}
              {linesRemoved !== null && linesRemoved > 0 && (
                <span className="text-red-400">-{linesRemoved}</span>
              )}
            </div>
          </div>
          <EventTimestamp timeStr={timeStr} elapsedStr={elapsedStr} />
        </div>
      )
    }

    case 'mcp_execution': {
      const server = String(payload.server ?? '')
      const toolName = String(payload.tool_name ?? '')
      const durationMs = typeof payload.duration_ms === 'number' ? payload.duration_ms : null
      return (
        <div className="flex items-center gap-3 py-1.5">
          <Zap className="h-4 w-4 text-teal-400 shrink-0" />
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <span className="text-sm font-mono text-teal-300 truncate">
              {server}{toolName ? `.${toolName}` : ''}
            </span>
            {durationMs !== null && (
              <Badge
                variant="outline"
                className={cn('text-[10px] px-1.5 py-0 h-4 shrink-0', getDurationBadgeClass(durationMs))}
              >
                {formatMs(durationMs)}
              </Badge>
            )}
          </div>
          <EventTimestamp timeStr={timeStr} elapsedStr={elapsedStr} />
        </div>
      )
    }

    case 'skill_load': {
      const skillName = String(payload.skill_name ?? payload.name ?? '')
      return (
        <div className="flex items-center gap-3 py-1.5">
          <BookOpen className="h-4 w-4 text-orange-400 shrink-0" />
          <span className="flex-1 text-sm text-orange-300">{skillName}</span>
          <EventTimestamp timeStr={timeStr} elapsedStr={elapsedStr} />
        </div>
      )
    }

    case 'agent_thought': {
      const content = String(payload.content_preview ?? payload.content ?? '')
      return (
        <div className="py-1.5">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-3 w-full text-left group"
          >
            <Brain className="h-4 w-4 text-muted-foreground/40 shrink-0" />
            <span className="flex items-center gap-1 flex-1 text-xs text-muted-foreground/50 italic group-hover:text-muted-foreground/70 transition-colors">
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Agent thought
            </span>
            <span className="text-[11px] text-muted-foreground/40 font-mono">{timeStr}</span>
          </button>
          {expanded && content && (
            <p className="text-xs text-muted-foreground/50 italic mt-1 ml-7 pl-3 border-l border-border/50 whitespace-pre-wrap">
              {content}
            </p>
          )}
        </div>
      )
    }

    case 'agent_response': {
      const content = String(payload.content_preview ?? payload.content ?? '')
      const preview = content.length > 120 ? content.slice(0, 120) + '…' : content
      return (
        <div className="py-1.5">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-3 w-full text-left group"
          >
            <MessageSquare className="h-4 w-4 text-foreground/60 shrink-0" />
            <span className="flex items-center gap-1 flex-1 text-xs text-foreground/70 font-medium group-hover:text-foreground transition-colors">
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              Agent response
            </span>
            <span className="text-[11px] text-muted-foreground font-mono">{timeStr}</span>
          </button>
          {!expanded && preview && (
            <p className="text-xs text-muted-foreground ml-7 mt-0.5 line-clamp-1">{preview}</p>
          )}
          {expanded && content && (
            <p className="text-xs text-muted-foreground ml-7 mt-1 pl-3 border-l border-border whitespace-pre-wrap">
              {content}
            </p>
          )}
        </div>
      )
    }

    case 'subagent_start': {
      const description = String(payload.description ?? '')
      return (
        <div className="flex items-center gap-3 py-1.5 pl-4">
          <GitBranch className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-xs text-muted-foreground/60">Subagent started </span>
            <span className="text-xs text-foreground/80">{description}</span>
          </div>
          <EventTimestamp timeStr={timeStr} elapsedStr={elapsedStr} />
        </div>
      )
    }

    case 'subagent_stop': {
      const description = String(payload.description ?? '')
      return (
        <div className="flex items-center gap-3 py-1.5 pl-4">
          <GitMerge className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-xs text-muted-foreground/60">Subagent finished </span>
            <span className="text-xs text-foreground/80">{description}</span>
          </div>
          <EventTimestamp timeStr={timeStr} elapsedStr={elapsedStr} />
        </div>
      )
    }

    case 'approval_requested': {
      const question = String(payload.question ?? '')
      return (
        <div className="flex items-start gap-3 py-2 px-3 rounded-md bg-yellow-500/5 border border-yellow-500/30">
          <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-[11px] text-yellow-500/70 font-medium block">Approval requested</span>
            <span className="text-sm text-yellow-200/80">{question}</span>
          </div>
          <EventTimestamp timeStr={timeStr} elapsedStr={elapsedStr} />
        </div>
      )
    }

    case 'error': {
      const errorMsg = String(payload.error_message ?? payload.error ?? 'Unknown error')
      return (
        <div className="flex items-start gap-3 py-2 px-3 rounded-md bg-red-500/5 border border-red-500/20">
          <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
          <span className="flex-1 text-sm text-red-300 break-all">{errorMsg}</span>
          <EventTimestamp timeStr={timeStr} elapsedStr={elapsedStr} />
        </div>
      )
    }

    case 'session_end': {
      const completionStatus = String(payload.completion_status ?? 'completed')
      const dodResult = payload.dod_result ? String(payload.dod_result) : null
      const isSuccess = completionStatus === 'completed' || completionStatus === 'success'
      return (
        <div className="flex items-start gap-3 py-2">
          <CheckSquare
            className={cn('h-4 w-4 mt-0.5 shrink-0', isSuccess ? 'text-green-400' : 'text-red-400')}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-foreground">Session ended</span>
              <Badge
                variant="outline"
                className={cn(
                  'text-[10px] px-1.5 py-0 h-4',
                  isSuccess
                    ? 'bg-green-500/15 text-green-400 border-green-500/30'
                    : 'bg-red-500/15 text-red-400 border-red-500/30'
                )}
              >
                {completionStatus}
              </Badge>
            </div>
            {dodResult && (
              <p className="text-xs text-muted-foreground mt-0.5">{dodResult}</p>
            )}
          </div>
          <EventTimestamp timeStr={timeStr} elapsedStr={elapsedStr} />
        </div>
      )
    }

    default:
      return (
        <div className="flex items-center gap-3 py-1.5">
          <div className="h-4 w-4 rounded-full bg-muted/40 shrink-0" />
          <span className="flex-1 text-xs text-muted-foreground/60 font-mono">{log.event_type}</span>
          <span className="text-[11px] text-muted-foreground/40 font-mono">{timeStr}</span>
        </div>
      )
  }
}

export function ExecutionLog({ workOrderId, initialLogs, isRunning }: Props) {
  const [logs, setLogs] = useState<AgentLog[]>(initialLogs)
  const scrollRef = useRef<HTMLDivElement>(null)
  const supabase = useMemo(() => createSupabaseClient(), [])

  const sessionStart = logs.length > 0 ? new Date(logs[0].created_at) : null

  useEffect(() => {
    const channel = supabase
      .channel(`agent_logs:wo:${workOrderId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'agent_logs',
          filter: `work_order_id=eq.${workOrderId}`,
        },
        (payload) => {
          const newLog = payload.new as AgentLog
          setLogs((prev) => {
            if (prev.some((l) => l.id === newLog.id)) return prev
            return [...prev, newLog]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [workOrderId, supabase])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs])

  return (
    <div ref={scrollRef} className="h-full overflow-y-auto px-4 py-2 space-y-0.5">
      {logs.length === 0 && (
        <div className="flex items-center justify-center h-32">
          {isRunning ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Waiting for agent...</span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">No events recorded</span>
          )}
        </div>
      )}

      {logs.map((log) => (
        <EventRow key={log.id} log={log} sessionStart={sessionStart} />
      ))}

      {isRunning && logs.length > 0 && (
        <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Waiting for agent...</span>
        </div>
      )}
    </div>
  )
}
