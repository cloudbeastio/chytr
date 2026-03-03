import { createSupabaseServerClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ContractStats } from '@/components/contracts/contract-stats'
import {
  ChevronLeft,
  FileText,
  ClipboardList,
  Calendar,
  LayoutTemplate,
  Pencil,
} from 'lucide-react'
import type {
  Contract,
  ContractStatRow,
  WorkOrder,
  WorkOrderStatus,
  ScheduledJob,
  WorkOrderTemplate,
} from '@/lib/database.types'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  active: 'Active',
  paused: 'Paused',
  closed: 'Closed',
}

const WO_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  draft: 'Draft',
  pending: 'Pending',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
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

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  const { data: contractRow, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !contractRow) notFound()
  const contract = contractRow as Contract

  const { data: stats } = await supabase
    .from('contract_stats')
    .select('*')
    .eq('contract_id', id)
    .single()

  const [woRes, jobsRes, templatesRes] = await Promise.all([
    supabase
      .from('work_orders')
      .select('id, objective, status, created_at, total_cost')
      .eq('contract_id', id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('scheduled_jobs')
      .select('id, name, cron_expression, enabled, last_run_at')
      .eq('contract_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('work_order_templates')
      .select('id, name, description, created_at')
      .eq('contract_id', id)
      .order('created_at', { ascending: false }),
  ])

  const workOrders = (woRes.data ?? []) as WorkOrder[]
  const jobs = (jobsRes.data ?? []) as ScheduledJob[]
  const templates = (templatesRes.data ?? []) as WorkOrderTemplate[]

  return (
    <div className="space-y-6 max-w-full">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/contracts">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-semibold tracking-tight truncate">{contract.name}</h1>
            {contract.is_default && (
              <Badge variant="secondary" className="text-[10px]">Default</Badge>
            )}
            <Badge variant="outline" className="text-[11px]">
              {STATUS_LABELS[contract.status] ?? contract.status}
            </Badge>
          </div>
          {(contract.account_name || contract.account_contact || contract.account_email) && (
            <p className="text-sm text-muted-foreground mt-1">
              {[contract.account_name, contract.account_contact, contract.account_email]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>
        <Button size="sm" variant="outline" asChild>
          <Link href={`/contracts/${id}/edit`}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </Link>
        </Button>
      </div>

      <ContractStats stats={stats as ContractStatRow | null} budgetLimit={contract.budget_limit} />

      <Tabs defaultValue="work_orders" className="w-full">
        <TabsList>
          <TabsTrigger value="work_orders" className="gap-1.5">
            <ClipboardList className="h-3.5 w-3.5" />
            Work orders ({workOrders.length})
          </TabsTrigger>
          <TabsTrigger value="jobs" className="gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Scheduled jobs ({jobs.length})
          </TabsTrigger>
          <TabsTrigger value="templates" className="gap-1.5">
            <LayoutTemplate className="h-3.5 w-3.5" />
            Templates ({templates.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="work_orders" className="mt-4">
          {workOrders.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">No work orders under this contract.</p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead className="text-xs font-medium">Objective</TableHead>
                    <TableHead className="text-xs font-medium w-28">Status</TableHead>
                    <TableHead className="text-xs font-medium w-24 text-right">Cost</TableHead>
                    <TableHead className="text-xs font-medium w-28 text-right">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workOrders.map((wo) => (
                    <TableRow key={wo.id} className="border-border">
                      <TableCell>
                        <Link href={`/work-orders/${wo.id}`} className="text-sm truncate block max-w-md hover:underline">
                          {wo.objective ?? (
                            <span className="text-muted-foreground italic">No objective</span>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[11px]">
                          {WO_STATUS_LABELS[wo.status]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                        ${Number(wo.total_cost ?? 0).toFixed(4)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                        {formatTimeAgo(new Date(wo.created_at))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="jobs" className="mt-4">
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">No scheduled jobs linked to this contract.</p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead className="text-xs font-medium">Name</TableHead>
                    <TableHead className="text-xs font-medium">Cron</TableHead>
                    <TableHead className="text-xs font-medium w-24">Enabled</TableHead>
                    <TableHead className="text-xs font-medium w-28 text-right">Last run</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((j) => (
                    <TableRow key={j.id} className="border-border">
                      <TableCell>
                        <Link href={`/jobs/${j.id}`} className="text-sm hover:underline">
                          {j.name}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{j.cron_expression}</TableCell>
                      <TableCell>
                        <Badge variant={j.enabled ? 'default' : 'secondary'} className="text-[11px]">
                          {j.enabled ? 'Yes' : 'No'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                        {j.last_run_at ? formatTimeAgo(new Date(j.last_run_at)) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6">No templates under this contract.</p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead className="text-xs font-medium">Name</TableHead>
                    <TableHead className="text-xs font-medium">Description</TableHead>
                    <TableHead className="text-xs font-medium w-28 text-right">Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((t) => (
                    <TableRow key={t.id} className="border-border">
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-md truncate">
                        {t.description ?? '—'}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                        {formatTimeAgo(new Date(t.created_at))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href={`/contracts/${id}/report`}>View report</Link>
        </Button>
      </div>
    </div>
  )
}
