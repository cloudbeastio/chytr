import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/api-auth'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { launchAgent } from '@/lib/services/launch-agent'

const UPDATABLE_FIELDS = [
  'objective', 'agent_id', 'repo_id', 'source', 'status', 'branch_name',
  'lines', 'constraints', 'exploration_hints', 'reference_patterns', 'tools',
  'verification', 'agent_config', 'environment', 'deliverables', 'metadata',
] as const

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(req)
  if (!auth.valid) return auth.response!

  try {
    const { id } = await params
    const supabase = createSupabaseServiceClient()

    const { data, error } = await supabase.rpc('get_work_order', {
      p_work_order_id: id,
    })

    if (error || !data) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[work-orders/GET/:id] unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(req)
  if (!auth.valid) return auth.response!

  try {
    const { id } = await params
    const body = (await req.json()) as { action?: string; [k: string]: unknown }
    const supabase = createSupabaseServiceClient()

    if (body.action === 'approve') {
      const { data: wo, error: fetchErr } = await supabase
        .from('work_orders')
        .select('id, status, source')
        .eq('id', id)
        .single()

      if (fetchErr || !wo) {
        return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
      }
      if (wo.status !== 'draft') {
        return NextResponse.json(
          { error: 'Only draft work orders can be approved' },
          { status: 400 }
        )
      }
      if (wo.source === 'local') {
        return NextResponse.json(
          { error: 'Local work orders cannot be launched' },
          { status: 400 }
        )
      }

      const { error: updateErr } = await supabase
        .from('work_orders')
        .update({ status: 'pending' })
        .eq('id', id)

      if (updateErr) {
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }

      const launchResult = await launchAgent(id)
      return NextResponse.json({
        ok: true,
        status: launchResult?.ok ? 'running' : 'pending',
        cursor_agent_id: launchResult?.cursor_agent_id ?? null,
        launch_error: launchResult?.ok ? null : (launchResult?.error ?? null),
      })
    }

    const update: Record<string, unknown> = {}
    for (const key of UPDATABLE_FIELDS) {
      if (body[key] !== undefined) update[key] = body[key]
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const { data, error } = await supabase
      .from('work_orders')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data)
  } catch (err) {
    console.error('[work-orders/PATCH/:id] unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
