import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/session'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { launchAgent } from '@/lib/services/launch-agent'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const supabase = createSupabaseServiceClient()

    const { data: wo, error: fetchErr } = await supabase
      .from('work_orders')
      .select('id, status, source')
      .eq('id', id)
      .eq('user_id', userId)
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
      .eq('user_id', userId)

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
  } catch (err) {
    console.error('[work-orders/approve] unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
