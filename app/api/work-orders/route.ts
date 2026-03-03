import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/session'
import { createSupabaseServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const {
      objective,
      agent_id,
      repo_id,
      lines,
      constraints,
      exploration_hints,
      verification,
      branch_name,
      reference_patterns,
      tools,
      agent_config,
      environment,
      deliverables,
      metadata,
    } = body

    if (!objective && !lines) {
      return NextResponse.json(
        { error: 'objective or lines required' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServiceClient()
    const { data: workOrder, error } = await supabase
      .from('work_orders')
      .insert({
        user_id: userId,
        objective: objective ?? null,
        agent_id: agent_id ?? null,
        repo_id: repo_id ?? null,
        source: 'cloud',
        status: 'draft',
        branch_name: branch_name ?? null,
        lines: lines ?? null,
        constraints: constraints ?? null,
        exploration_hints: exploration_hints ?? null,
        reference_patterns: reference_patterns ?? null,
        tools: tools ?? null,
        verification: verification ?? null,
        agent_config: agent_config ?? null,
        environment: environment ?? null,
        deliverables: deliverables ?? null,
        metadata: metadata ?? {},
      })
      .select()
      .single()

    if (error) {
      console.error('[work-orders/POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(workOrder, { status: 201 })
  } catch (err) {
    console.error('[work-orders/POST] unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
