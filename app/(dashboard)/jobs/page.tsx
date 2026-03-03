import { createSupabaseServerClient } from '@/lib/supabase'
import { FeatureGate } from '@/components/license/feature-gate'
import { JobsTable } from '@/components/jobs/jobs-table'
import { Skeleton } from '@/components/ui/skeleton'
import { Suspense } from 'react'
import type { ScheduledJob, JobRun, Agent, AgentRepo, Contract } from '@/lib/database.types'
import type { WorkOrderTemplate } from '@/lib/database.types'

export interface JobWithData extends ScheduledJob {
  latestRun: JobRun | null
  agentName: string | null
  repoUrl: string | null
}

async function JobsContent() {
  const supabase = await createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: rawJobs },
    { data: rawAgents },
    { data: rawRepos },
    { data: rawContracts },
    { data: rawTemplates },
  ] = await Promise.all([
    supabase.from('scheduled_jobs').select('*').order('created_at', { ascending: false }),
    supabase.from('agents').select('id, name').order('name'),
    supabase.from('agent_repos').select('id, agent_id, repo_url'),
    user ? supabase.from('contracts').select('id, name').eq('user_id', user.id).order('name') : Promise.resolve({ data: [] }),
    user ? supabase.from('work_order_templates').select('id, name, template').eq('user_id', user.id).order('name') : Promise.resolve({ data: [] }),
  ])

  const jobs = (rawJobs ?? []) as unknown as ScheduledJob[]
  const agents = (rawAgents ?? []) as unknown as Pick<Agent, 'id' | 'name'>[]
  const repos = (rawRepos ?? []) as unknown as Pick<AgentRepo, 'id' | 'agent_id' | 'repo_url'>[]
  const contracts = (rawContracts ?? []) as unknown as Pick<Contract, 'id' | 'name'>[]
  const templateOptions = (rawTemplates ?? []).map((t) => ({
    id: (t as WorkOrderTemplate).id,
    name: (t as WorkOrderTemplate).name,
    template: (t as WorkOrderTemplate).template as Record<string, unknown>,
  }))

  const jobIds = jobs.map((j) => j.id)
  const { data: rawRuns } = jobIds.length
    ? await supabase
        .from('job_runs')
        .select('*')
        .in('job_id', jobIds)
        .order('started_at', { ascending: false })
    : { data: [] as JobRun[] }

  const runs = (rawRuns ?? []) as unknown as JobRun[]

  const latestRunByJob: Record<string, JobRun> = {}
  for (const run of runs) {
    if (!latestRunByJob[run.job_id]) latestRunByJob[run.job_id] = run
  }

  const agentMap: Record<string, string> = {}
  for (const a of agents) agentMap[a.id] = a.name ?? ''

  const repoMap: Record<string, string> = {}
  for (const r of repos) if (r.id) repoMap[r.id] = r.repo_url

  const jobsWithData: JobWithData[] = jobs.map((job) => ({
    ...job,
    latestRun: latestRunByJob[job.id] ?? null,
    agentName: job.agent_id ? (agentMap[job.agent_id] ?? null) : null,
    repoUrl: job.repo_id ? (repoMap[job.repo_id] ?? null) : null,
  }))

  return (
    <JobsTable
      jobs={jobsWithData}
      agents={agents}
      repos={repos}
      contracts={contracts}
      templateOptions={templateOptions}
    />
  )
}

export default function JobsPage() {
  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Scheduled Jobs</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Automate recurring work orders on a cron schedule
        </p>
      </div>

      <FeatureGate feature="scheduled_jobs">
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
          <JobsContent />
        </Suspense>
      </FeatureGate>
    </div>
  )
}
