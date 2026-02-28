import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/api-auth'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { loadLicenseFromDB } from '@/lib/license'
import { launchAgent } from '@/lib/services/launch-agent'

export async function POST(req: NextRequest) {
  const auth = await validateApiKey(req)
  if (!auth.valid) return auth.response!

  try {
    const license = await loadLicenseFromDB()
    if (!license) {
      return NextResponse.json({ error: 'No valid license' }, { status: 403 })
    }

    const body = await req.json()
    const { objective, agent_id, repo_id, lines, constraints, exploration_hints, verification, branch_name, source, metadata } = body

    if (!objective && !lines) {
      return NextResponse.json(
        { error: 'objective or lines required' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServiceClient()

    const { data: workOrder, error: insertError } = await supabase
      .from('work_orders')
      .insert({
        objective: objective ?? null,
        agent_id: agent_id ?? null,
        repo_id: repo_id ?? null,
        source: source ?? 'cloud',
        status: 'pending',
        branch_name: branch_name ?? null,
        lines: lines ?? null,
        constraints: constraints ?? null,
        exploration_hints: exploration_hints ?? null,
        verification: verification ?? null,
        metadata: metadata ?? {},
      })
      .select()
      .single()

    if (insertError || !workOrder) {
      console.error('[work-orders/POST] insert error', insertError)
      return NextResponse.json(
        { error: insertError?.message ?? 'Failed to create work order' },
        { status: 500 }
      )
    }

    let launchResult = null
    if (workOrder.source !== 'local') {
      launchResult = await launchAgent(workOrder.id)
      if (!launchResult.ok && !launchResult.skipped) {
        console.error('[work-orders/POST] launch error', launchResult.error)
      }
    }

    return NextResponse.json(
      {
        ok: true,
        work_order_id: workOrder.id,
        status: workOrder.source === 'local' ? 'pending' : (launchResult?.ok ? 'running' : 'pending'),
        cursor_agent_id: launchResult?.cursor_agent_id ?? null,
        launch_error: launchResult?.ok ? null : (launchResult?.error ?? null),
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('[work-orders/POST] unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const auth = await validateApiKey(req)
  if (!auth.valid) return auth.response!

  try {
    const supabase = createSupabaseServiceClient()
    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const source = url.searchParams.get('source')
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 200)

    let query = supabase
      .from('work_orders')
      .select('*, agents!agent_id(name), agent_repos!repo_id(repo_url)')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (status) query = query.eq('status', status)
    if (source) query = query.eq('source', source)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ work_orders: data ?? [] })
  } catch (err) {
    console.error('[work-orders/GET] unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
