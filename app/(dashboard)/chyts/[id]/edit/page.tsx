import { createSupabaseServerClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { ChytForm } from '@/components/chyts/chyt-form'
import type { Chyt, Agent, AgentRepo, Project } from '@/lib/database.types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditChytPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: wo, error: woError },
    { data: rawAgents },
    { data: rawRepos },
    { data: rawContracts },
  ] = await Promise.all([
    supabase.from('chyts').select('*').eq('id', id).single(),
    supabase.from('agents').select('id, name').order('name'),
    supabase.from('agent_repos').select('id, agent_id, repo_url'),
    user
      ? supabase.from('projects').select('id, name, is_default').eq('user_id', user.id).order('name')
      : Promise.resolve({ data: [] }),
  ])

  if (woError || !wo) notFound()

  const workOrder = wo as Chyt
  const agents = (rawAgents ?? []) as unknown as Pick<Agent, 'id' | 'name'>[]
  const repos = (rawRepos ?? []) as unknown as Pick<AgentRepo, 'id' | 'agent_id' | 'repo_url'>[]
  const contracts = (rawContracts ?? []) as unknown as Pick<Project, 'id' | 'name' | 'is_default'>[]

  return (
    <div className="space-y-6 max-w-full">
      <p className="text-sm text-muted-foreground">
        Update the work order. Drafts can be approved from the record page to launch the agent.
      </p>
      <ChytForm
        agents={agents}
        repos={repos}
        contracts={contracts}
        workOrder={workOrder}
        isEdit={true}
      />
    </div>
  )
}
