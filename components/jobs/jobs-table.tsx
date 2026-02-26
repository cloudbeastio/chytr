'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import cronstrue from 'cronstrue'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { JobForm } from '@/components/jobs/job-form'
import { Plus, MoreHorizontal, Play, Pencil, Trash2 } from 'lucide-react'
import type { JobRunStatus } from '@/lib/database.types'
import type { JobWithData } from '@/app/(dashboard)/jobs/page'
import type { Agent, AgentRepo } from '@/lib/database.types'
import { cn } from '@/lib/utils'

const RUN_STATUS_BADGE: Record<
  JobRunStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  pending: { label: 'Pending', variant: 'secondary' },
  running: { label: 'Running', variant: 'default' },
  completed: { label: 'Completed', variant: 'outline' },
  failed: { label: 'Failed', variant: 'destructive' },
}

function humanCron(expr: string): string {
  try {
    return cronstrue.toString(expr, { use24HourTimeFormat: true })
  } catch {
    return expr
  }
}

function formatNextRun(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const diff = d.getTime() - Date.now()
  if (diff < 0) return 'Overdue'
  const m = Math.floor(diff / 60000)
  if (m < 60) return `in ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `in ${h}h`
  return `in ${Math.floor(h / 24)}d`
}

function Toggle({
  checked,
  onToggle,
  disabled,
}: {
  checked: boolean
  onToggle: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      aria-checked={checked}
      role="switch"
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-muted'
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0'
        )}
      />
    </button>
  )
}

interface JobsTableProps {
  jobs: JobWithData[]
  agents: Pick<Agent, 'id' | 'name'>[]
  repos: Pick<AgentRepo, 'id' | 'agent_id' | 'repo_url'>[]
}

export function JobsTable({ jobs, agents, repos }: JobsTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [formOpen, setFormOpen] = useState(false)
  const [editJob, setEditJob] = useState<JobWithData | null>(null)
  const [loadingJobId, setLoadingJobId] = useState<string | null>(null)

  function refresh() {
    startTransition(() => router.refresh())
  }

  async function handleToggle(job: JobWithData) {
    setLoadingJobId(job.id)
    try {
      await fetch(`/api/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !job.enabled }),
      })
      refresh()
    } finally {
      setLoadingJobId(null)
    }
  }

  async function handleRunNow(jobId: string) {
    setLoadingJobId(jobId)
    try {
      await fetch(`/api/jobs/${jobId}/run`, { method: 'POST' })
      refresh()
    } finally {
      setLoadingJobId(null)
    }
  }

  async function handleDelete(jobId: string) {
    if (!confirm('Delete this job?')) return
    setLoadingJobId(jobId)
    try {
      await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' })
      refresh()
    } finally {
      setLoadingJobId(null)
    }
  }

  function openEdit(job: JobWithData) {
    setEditJob(job)
    setFormOpen(true)
  }

  function handleFormClose(open: boolean) {
    setFormOpen(open)
    if (!open) setEditJob(null)
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-base">Jobs</CardTitle>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Job
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12 px-6">
              No scheduled jobs yet. Create one to automate recurring work orders.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Repo</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead>Next Run</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => {
                  const run = job.latestRun
                  const runBadge = run ? RUN_STATUS_BADGE[run.status] : null
                  const isLoading = loadingJobId === job.id || isPending

                  return (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">
                        <a
                          href={`/jobs/${job.id}`}
                          className="hover:underline underline-offset-2"
                        >
                          {job.name}
                        </a>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="text-xs font-mono text-muted-foreground">
                            {job.cron_expression}
                          </p>
                          <p className="text-xs">{humanCron(job.cron_expression)}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {job.agentName ?? '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">
                        {job.repoUrl ? (
                          <span title={job.repoUrl}>{job.repoUrl.replace(/^https?:\/\//, '')}</span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>
                        <Toggle
                          checked={job.enabled}
                          onToggle={() => handleToggle(job)}
                          disabled={isLoading}
                        />
                      </TableCell>
                      <TableCell>
                        {runBadge ? (
                          <Badge variant={runBadge.variant}>{runBadge.label}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatNextRun(job.next_run_at)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              disabled={isLoading}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleRunNow(job.id)}>
                              <Play className="h-3.5 w-3.5 mr-2" />
                              Run Now
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(job)}>
                              <Pencil className="h-3.5 w-3.5 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(job.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <JobForm
        open={formOpen}
        onOpenChange={handleFormClose}
        agents={agents}
        repos={repos}
        job={editJob ?? undefined}
        onSuccess={refresh}
      />
    </>
  )
}
