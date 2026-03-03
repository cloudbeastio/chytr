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
      project_id,
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
    const { data: chyt, error } = await supabase
      .from('chyts')
      .insert({
        user_id: userId,
        project_id: project_id ?? null,
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
      console.error('[chyts/POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(chyt, { status: 201 })
  } catch (err) {
    console.error('[chyts/POST] unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
