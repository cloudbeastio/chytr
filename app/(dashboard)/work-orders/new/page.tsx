import { createSupabaseServerClient } from '@/lib/supabase'
import { WorkOrderForm } from '@/components/work-orders/work-order-form'
import type { Agent, AgentRepo } from '@/lib/database.types'

export default async function NewWorkOrderPage() {
  const supabase = await createSupabaseServerClient()

  const [
    { data: rawAgents },
    { data: rawRepos },
  ] = await Promise.all([
    supabase.from('agents').select('id, name').order('name'),
    supabase.from('agent_repos').select('id, agent_id, repo_url'),
  ])

  const agents = (rawAgents ?? []) as unknown as Pick<Agent, 'id' | 'name'>[]
  const repos = (rawRepos ?? []) as unknown as Pick<AgentRepo, 'id' | 'agent_id' | 'repo_url'>[]

  return (
    <div className="space-y-6 max-w-full">
      <p className="text-sm text-muted-foreground">
        Create a draft work order. Approve it from the record page to launch the agent.
      </p>
      <WorkOrderForm agents={agents} repos={repos} workOrder={null} isEdit={false} />
    </div>
  )
}
