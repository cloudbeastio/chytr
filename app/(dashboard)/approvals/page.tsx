import { createSupabaseServerClient } from '@/lib/supabase'
import { FeatureGate } from '@/components/license/feature-gate'
import { ApprovalsContent } from '@/components/approvals/approvals-content'
import { Skeleton } from '@/components/ui/skeleton'
import { Suspense } from 'react'
import type { Approval } from '@/lib/database.types'

export interface ApprovalWithMeta extends Approval {
  agentName: string | null
}

async function ApprovalsData() {
  const supabase = await createSupabaseServerClient()

  const [{ data: pending }, { data: history }] = await Promise.all([
    supabase
      .from('approvals')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
    supabase
      .from('approvals')
      .select('*')
      .neq('status', 'pending')
      .order('decided_at', { ascending: false })
      .limit(50),
  ])

  const allApprovals = [...(pending ?? []), ...(history ?? [])] as unknown as Array<{ agent_id: string | null }>
  const agentIds = [...new Set(allApprovals.map((a) => a.agent_id).filter(Boolean))] as string[]

  const { data: agents } =
    agentIds.length
      ? await supabase.from('agents').select('id, name').in('id', agentIds)
      : { data: [] as { id: string; name: string }[] }

  const agentMap: Record<string, string> = {}
  for (const a of agents ?? []) agentMap[a.id] = a.name

  const toMeta = (a: Approval): ApprovalWithMeta => ({
    ...a,
    agentName: a.agent_id ? (agentMap[a.agent_id] ?? null) : null,
  })

  return (
    <ApprovalsContent
      pending={(pending ?? []).map(toMeta)}
      history={(history ?? []).map(toMeta)}
    />
  )
}

export default function ApprovalsPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Approvals</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Review and respond to agent approval requests
        </p>
      </div>

      <FeatureGate feature="approvals">
        <Suspense fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
          <ApprovalsData />
        </Suspense>
      </FeatureGate>
    </div>
  )
}
