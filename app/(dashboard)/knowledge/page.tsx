import { Suspense } from 'react'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { loadLicenseFromDB } from '@/lib/license'
import { Skeleton } from '@/components/ui/skeleton'
import { KnowledgeBrowser } from '@/components/knowledge/knowledge-browser'
import type { Knowledge } from '@/lib/database.types'

const INITIAL_FETCH_LIMIT = 200

async function fetchKnowledgeData() {
  const supabase = createSupabaseServiceClient()

  const [{ data: entries, count }, license] = await Promise.all([
    supabase
      .from('knowledge')
      .select('*', { count: 'exact' })
      .order('frequency', { ascending: false })
      .order('last_seen_at', { ascending: false })
      .limit(INITIAL_FETCH_LIMIT),
    loadLicenseFromDB(),
  ])

  const agentTypes = Array.from(
    new Set((entries ?? []).map((e) => e.agent_type).filter(Boolean) as string[])
  ).sort()

  return {
    entries: (entries ?? []) as Knowledge[],
    totalCount: count ?? 0,
    agentTypes,
    knowledgeLimit: license?.limits.knowledge_entries ?? 500,
  }
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-2 w-40" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-36" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border border-border rounded-lg p-4 space-y-2">
            <div className="flex justify-between gap-3">
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <Skeleton className="h-5 w-8 shrink-0" />
            </div>
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
    </div>
  )
}

async function KnowledgeContent() {
  const { entries, totalCount, agentTypes, knowledgeLimit } = await fetchKnowledgeData()
  return (
    <KnowledgeBrowser
      initialEntries={entries}
      agentTypes={agentTypes}
      totalCount={totalCount}
      knowledgeLimit={knowledgeLimit}
    />
  )
}

export default function KnowledgePage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Knowledge</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Learnings extracted from agent work orders
        </p>
      </div>

      <Suspense fallback={<LoadingSkeleton />}>
        <KnowledgeContent />
      </Suspense>
    </div>
  )
}
