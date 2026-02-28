import { createSupabaseServerClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import type { JobRun, ScheduledJob } from '@/lib/database.types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { JobDetailActions } from '@/components/jobs/job-detail-actions'
import type { JobRunStatus } from '@/lib/database.types'

const RUN_STATUS_BADGE: Record<
  JobRunStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  pending: { label: 'Pending', variant: 'secondary' },
  running: { label: 'Running', variant: 'default' },
  completed: { label: 'Completed', variant: 'outline' },
  failed: { label: 'Failed', variant: 'destructive' },
}

function formatDuration(startedAt: string, finishedAt: string | null): string {
  if (!finishedAt) return '—'
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime()
  if (ms < 1000) return `${ms}ms`
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  return `${m}m ${s % 60}s`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function JobDetailPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()

  const { data: rawJob } = await supabase
    .from('scheduled_jobs')
    .select('*')
    .eq('id', id)
    .single()

  if (!rawJob) notFound()
  const job = rawJob as unknown as ScheduledJob

  const [{ data: rawRuns }, { data: rawAgents }, { data: rawRepos }] = await Promise.all([
    supabase
      .from('job_runs')
      .select('*')
      .eq('job_id', job.id)
      .order('started_at', { ascending: false })
      .limit(50),
    supabase.from('agents').select('id, name').order('name'),
    supabase.from('agent_repos').select('id, agent_id, repo_url'),
  ])

  const runs = rawRuns as unknown as JobRun[]
  const agents = (rawAgents ?? []) as unknown as Array<{ id: string; name: string }>
  const repos = (rawRepos ?? []) as unknown as Array<{ id: string; agent_id: string | null; repo_url: string }>

  const agentName = agents.find((a) => a.id === job.agent_id)?.name ?? null
  const repoUrl = repos.find((r) => r.id === job.repo_id)?.repo_url ?? null

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <a href="/jobs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Jobs
            </a>
            <span className="text-muted-foreground text-sm">/</span>
            <span className="text-sm">{job.name}</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight">{job.name}</h1>
          {job.description && (
            <p className="text-sm text-muted-foreground mt-0.5">{job.description}</p>
          )}
        </div>
        <JobDetailActions
          job={job}
          agents={(agents ?? []) as { id: string; name: string }[]}
          repos={(repos ?? []) as { id: string; agent_id: string | null; repo_url: string }[]}
        />
      </div>

      {/* Details card */}
      <Card>
        <CardContent className="pt-5">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">Status</dt>
              <dd>
                <Badge variant={job.enabled ? 'default' : 'secondary'}>
                  {job.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">Cron</dt>
              <dd className="text-sm font-mono">{job.cron_expression}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">Agent</dt>
              <dd className="text-sm">{agentName ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground mb-0.5">Repository</dt>
              <dd className="text-sm truncate" title={repoUrl ?? undefined}>
                {repoUrl ? repoUrl.replace(/^https?:\/\//, '') : '—'}
              </dd>
            </div>
            {job.last_run_at && (
              <div>
                <dt className="text-xs text-muted-foreground mb-0.5">Last Run</dt>
                <dd className="text-sm">{formatDate(job.last_run_at)}</dd>
              </div>
            )}
            {job.next_run_at && (
              <div>
                <dt className="text-xs text-muted-foreground mb-0.5">Next Run</dt>
                <dd className="text-sm">{formatDate(job.next_run_at)}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Run history */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Run History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!runs?.length ? (
            <p className="text-sm text-muted-foreground text-center py-10 px-6">
              No runs yet. Trigger manually or wait for the next scheduled run.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Work Order</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => {
                  const badge = RUN_STATUS_BADGE[run.status]
                  return (
                    <TableRow key={run.id}>
                      <TableCell className="text-sm">{formatDate(run.started_at)}</TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDuration(run.started_at, run.finished_at)}
                      </TableCell>
                      <TableCell>
                        {run.work_order_id ? (
                          <a
                            href={`/work-orders/${run.work_order_id}`}
                            className="text-sm underline underline-offset-2 hover:text-foreground text-muted-foreground"
                          >
                            {run.work_order_id.slice(0, 8)}…
                          </a>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-destructive max-w-xs truncate">
                        {run.error_message ?? '—'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
