import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { AgentStatus } from '@/lib/database.types'

export interface AgentFleetItem {
  id: string
  name: string
  status: AgentStatus
  type: string | null
  last_heartbeat: string | null
  running: number
  completed: number
  failed: number
}

const STATUS_DOT: Record<AgentStatus, string> = {
  active: 'bg-green-500',
  idle: 'bg-yellow-400',
  offline: 'bg-muted-foreground/50',
  error: 'bg-red-500',
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'never'
  const sec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

interface AgentFleetProps {
  agents: AgentFleetItem[]
}

export function AgentFleet({ agents }: AgentFleetProps) {
  if (!agents.length) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Agent Fleet</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">No agents registered</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Agent Fleet</CardTitle>
          <span className="text-xs text-muted-foreground">{agents.length} total</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {agents.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-6 py-2.5">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={cn('w-2 h-2 rounded-full shrink-0', STATUS_DOT[a.status] ?? STATUS_DOT.offline)} />
                  </TooltipTrigger>
                  <TooltipContent className="capitalize">{a.status}</TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{a.name}</span>
                  {a.type && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize shrink-0">
                      {a.type}
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Heartbeat {timeAgo(a.last_heartbeat)}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0 text-xs tabular-nums">
                {a.running > 0 && (
                  <span className="text-blue-400">{a.running} running</span>
                )}
                <span className="text-green-400">{a.completed}</span>
                <span className="text-muted-foreground">/</span>
                <span className="text-red-400">{a.failed}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
