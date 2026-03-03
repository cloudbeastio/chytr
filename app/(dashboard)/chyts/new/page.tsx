import { createSupabaseServerClient } from '@/lib/supabase'
import { ChytForm } from '@/components/chyts/chyt-form'
import type { Agent, AgentRepo, Project } from '@/lib/database.types'

export default async function NewChytPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [
    { data: rawAgents },
    { data: rawRepos },
    { data: rawContracts },
  ] = await Promise.all([
    supabase.from('agents').select('id, name').order('name'),
    supabase.from('agent_repos').select('id, agent_id, repo_url'),
    user
      ? supabase.from('projects').select('id, name, is_default').eq('user_id', user.id).order('name')
      : Promise.resolve({ data: [] }),
  ])

  const agents = (rawAgents ?? []) as unknown as Pick<Agent, 'id' | 'name'>[]
  const repos = (rawRepos ?? []) as unknown as Pick<AgentRepo, 'id' | 'agent_id' | 'repo_url'>[]
  const contracts = (rawContracts ?? []) as unknown as Pick<Project, 'id' | 'name' | 'is_default'>[]

  return (
    <div className="space-y-6 max-w-full">
      <p className="text-sm text-muted-foreground">
        Create a draft work order. Approve it from the record page to launch the agent.
      </p>
      <ChytForm agents={agents} repos={repos} contracts={contracts} workOrder={null} isEdit={false} />
    </div>
  )
}
