import { createSupabaseServiceClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Suspense } from 'react'
import { ClipboardList, Bot, Zap, CheckCircle, Clock } from 'lucide-react'
import type { WorkOrderStatus } from '@/lib/database.types'

const STATUS_BADGE: Record<WorkOrderStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pending', variant: 'secondary' },
  running: { label: 'Running', variant: 'default' },
  completed: { label: 'Completed', variant: 'outline' },
  failed: { label: 'Failed', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'secondary' },
}

async function DashboardStats() {
  const supabase = createSupabaseServiceClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [
    { count: totalWorkOrders },
    { count: activeAgents },
    { count: toolCallsToday },
    { count: pendingApprovals },
  ] = await Promise.all([
    supabase.from('work_orders').select('*', { count: 'exact', head: true }),
    supabase.from('agents').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase
      .from('agent_logs')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'tool_call')
      .gte('created_at', today.toISOString()),
    supabase.from('approvals').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  const stats = [
    {
      label: 'Work Orders',
      value: totalWorkOrders ?? 0,
      icon: ClipboardList,
      description: 'Total all time',
    },
    {
      label: 'Active Agents',
      value: activeAgents ?? 0,
      icon: Bot,
      description: 'Currently online',
    },
    {
      label: 'Tool Calls Today',
      value: toolCallsToday ?? 0,
      icon: Zap,
      description: 'Since midnight',
    },
    {
      label: 'Pending Approvals',
      value: pendingApprovals ?? 0,
      icon: CheckCircle,
      description: 'Awaiting review',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map(({ label, value, icon: Icon, description }) => (
        <Card key={label}>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{value.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
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

async function RecentActivity() {
  const supabase = createSupabaseServiceClient()

  const { data: workOrders } = await supabase
    .from('work_orders')
    .select('id, objective, status, created_at, agent_id')
    .order('created_at', { ascending: false })
    .limit(10)

  if (!workOrders?.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-6 text-center">
            No work orders yet. Activity will appear here once agents start running.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {workOrders.map((wo) => {
            const badgeCfg = STATUS_BADGE[wo.status] ?? STATUS_BADGE.pending
            const ts = new Date(wo.created_at)
            const timeAgo = formatTimeAgo(ts)
            return (
              <div key={wo.id} className="flex items-start gap-3 px-6 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">
                    {wo.objective ?? <span className="text-muted-foreground italic">No objective</span>}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground">{timeAgo}</span>
                  </div>
                </div>
                <Badge variant={badgeCfg.variant} className="shrink-0 mt-0.5">
                  {badgeCfg.label}
                </Badge>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function ActivitySkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function LeaderboardsPlaceholder() {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-base text-muted-foreground">Leaderboards</CardTitle>
      </CardHeader>
      <CardContent className="py-8 text-center">
        <p className="text-sm text-muted-foreground">Coming soon</p>
        <p className="text-xs text-muted-foreground mt-1">
          Agent performance rankings and tool usage analytics
        </p>
      </CardContent>
    </Card>
  )
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

export default function DashboardPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Overview of your agent activity
        </p>
      </div>

      <Suspense fallback={<StatsSkeleton />}>
        <DashboardStats />
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Suspense fallback={<ActivitySkeleton />}>
            <RecentActivity />
          </Suspense>
        </div>
        <div>
          <LeaderboardsPlaceholder />
        </div>
      </div>
    </div>
  )
}
