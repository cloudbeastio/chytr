'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { JobForm } from '@/components/jobs/job-form'
import { Play, Pencil } from 'lucide-react'
import type { ScheduledJob, Agent, AgentRepo } from '@/lib/database.types'

interface JobDetailActionsProps {
  job: ScheduledJob
  agents: Pick<Agent, 'id' | 'name'>[]
  repos: Pick<AgentRepo, 'id' | 'agent_id' | 'repo_url'>[]
}

export function JobDetailActions({ job, agents, repos }: JobDetailActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [formOpen, setFormOpen] = useState(false)
  const [running, setRunning] = useState(false)

  function refresh() {
    startTransition(() => router.refresh())
  }

  async function handleRunNow() {
    setRunning(true)
    try {
      await fetch(`/api/jobs/${job.id}/run`, { method: 'POST' })
      refresh()
    } finally {
      setRunning(false)
    }
  }

  const disabled = running || isPending

  return (
    <>
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" onClick={handleRunNow} disabled={disabled}>
          <Play className="h-3.5 w-3.5 mr-1.5" />
          {running ? 'Running…' : 'Run Now'}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setFormOpen(true)} disabled={disabled}>
          <Pencil className="h-3.5 w-3.5 mr-1.5" />
          Edit
        </Button>
      </div>

      <JobForm
        open={formOpen}
        onOpenChange={setFormOpen}
        agents={agents}
        repos={repos}
        job={job}
        onSuccess={refresh}
      />
    </>
  )
}
