import { createSupabaseServerClient } from '@/lib/supabase'
import { notFound } from 'next/navigation'
import { WorkOrderForm } from '@/components/work-orders/work-order-form'
import type { WorkOrder, Agent, AgentRepo } from '@/lib/database.types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditWorkOrderPage({ params }: PageProps) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()

  const [
    { data: wo, error: woError },
    { data: rawAgents },
    { data: rawRepos },
  ] = await Promise.all([
    supabase.from('work_orders').select('*').eq('id', id).single(),
    supabase.from('agents').select('id, name').order('name'),
    supabase.from('agent_repos').select('id, agent_id, repo_url'),
  ])

  if (woError || !wo) notFound()

  const workOrder = wo as WorkOrder
  const agents = (rawAgents ?? []) as unknown as Pick<Agent, 'id' | 'name'>[]
  const repos = (rawRepos ?? []) as unknown as Pick<AgentRepo, 'id' | 'agent_id' | 'repo_url'>[]

  return (
    <div className="space-y-6 max-w-full">
      <p className="text-sm text-muted-foreground">
        Update the work order. Drafts can be approved from the record page to launch the agent.
      </p>
      <WorkOrderForm
        agents={agents}
        repos={repos}
        workOrder={workOrder}
        isEdit={true}
      />
    </div>
  )
}
