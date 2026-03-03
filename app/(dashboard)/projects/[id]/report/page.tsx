import { createSupabaseServerClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { WOVolumeChart } from '@/components/dashboard/wo-volume-chart'
import { ChevronLeft } from 'lucide-react'
import type { Project, Chyt, ChytStatus } from '@/lib/database.types'

function formatCost(n: number): string {
  if (n === 0) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n)
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export default async function ProjectReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: contractRow, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !contractRow) notFound()
  const contract = contractRow as Project

  const { data: workOrders } = await supabase
    .from('chyts')
    .select('id, objective, status, created_at, total_cost, agent_id')
    .eq('project_id', id)
    .order('created_at', { ascending: false })

  const wos = (workOrders ?? []) as Chyt[]

  const totalCost = wos.reduce((s, wo) => s + Number(wo.total_cost ?? 0), 0)
  const budgetLimit = contract.budget_limit != null ? Number(contract.budget_limit) : null
  const budgetUtil = budgetLimit != null && budgetLimit > 0
    ? Math.min(100, (totalCost / budgetLimit) * 100)
    : null

  const statusCounts: Record<ChytStatus, number> = {
    draft: 0,
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
  }
  for (const wo of wos) {
    if (wo.status in statusCounts) statusCounts[wo.status as ChytStatus]++
  }

  const woByDay: Record<string, number> = {}
  for (const wo of wos) {
    const day = wo.created_at.slice(0, 10)
    woByDay[day] = (woByDay[day] ?? 0) + 1
  }
  const woTimeSeries = Object.entries(woByDay)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }))

  const agentIds = [...new Set(wos.map((wo) => wo.agent_id).filter(Boolean))] as string[]
  let agentNames: Record<string, string> = {}
  if (agentIds.length > 0) {
    const { data: agents } = await supabase
      .from('agents')
      .select('id, name')
      .in('id', agentIds)
    agentNames = Object.fromEntries(((agents ?? []) as { id: string; name: string }[]).map((a) => [a.id, a.name]))
  }

  const costByAgent: Record<string, { cost: number; count: number }> = {}
  for (const wo of wos) {
    const aid = wo.agent_id ?? '_none'
    if (!costByAgent[aid]) costByAgent[aid] = { cost: 0, count: 0 }
    costByAgent[aid].cost += Number(wo.total_cost ?? 0)
    costByAgent[aid].count += 1
  }
  const agentBreakdown = Object.entries(costByAgent)
    .map(([agentId, { cost, count }]) => ({
      name: agentId === '_none' ? 'No agent' : (agentNames[agentId] ?? agentId.slice(0, 8)),
      cost,
      count,
    }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 10)

  return (
    <div className="space-y-6 max-w-full">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${id}`}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Report: {contract.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Cost and volume by work order and agent</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total spend</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{formatCost(totalCost)}</p>
            {budgetLimit != null && budgetLimit > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Budget: {formatCost(budgetLimit)}
                {budgetUtil != null && ` (${budgetUtil.toFixed(0)}% used)`}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Work orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{wos.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {statusCounts.completed} completed · {statusCounts.failed} failed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status mix</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {(['completed', 'failed', 'running', 'pending', 'draft', 'cancelled'] as const).map(
                (s) =>
                  statusCounts[s] > 0 && (
                    <span key={s}>
                      {s}: {statusCounts[s]}
                    </span>
                  )
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {woTimeSeries.length > 0 && (
        <WOVolumeChart data={woTimeSeries} />
      )}

      {agentBreakdown.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cost by agent</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Top 10 by spend</p>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border">
                  <TableHead className="text-xs font-medium">Agent</TableHead>
                  <TableHead className="text-xs font-medium w-20 text-right">WOs</TableHead>
                  <TableHead className="text-xs font-medium w-28 text-right">Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agentBreakdown.map((row) => (
                  <TableRow key={row.name} className="border-border">
                    <TableCell className="text-sm">{row.name}</TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                      {row.count}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {formatCost(row.cost)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Cost by work order</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Recent work orders (up to 50)</p>
        </CardHeader>
        <CardContent>
          {wos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No work orders.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border">
                  <TableHead className="text-xs font-medium">Objective</TableHead>
                  <TableHead className="text-xs font-medium w-24">Status</TableHead>
                  <TableHead className="text-xs font-medium w-28 text-right">Cost</TableHead>
                  <TableHead className="text-xs font-medium w-32 text-right">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {wos.slice(0, 50).map((wo) => (
                  <TableRow key={wo.id} className="border-border">
                    <TableCell>
                      <Link href={`/chyts/${wo.id}`} className="text-sm truncate block max-w-md hover:underline">
                        {wo.objective ?? (
                          <span className="text-muted-foreground italic">No objective</span>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="text-xs">{wo.status}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {formatCost(Number(wo.total_cost ?? 0))}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                      {new Date(wo.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
