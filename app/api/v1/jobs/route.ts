import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { authenticateApiKey } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateApiKey(req)
    if (!auth) {
      return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
    }

    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase
      .from('scheduled_jobs')
      .select('*')
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[v1/jobs GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ jobs: data ?? [] })
  } catch (err) {
    console.error('[v1/jobs GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateApiKey(req)
    if (!auth) {
      return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
    }

    const body = (await req.json()) as {
      name?: string
      cron_expression?: string
      agent_id?: string
      repo_id?: string
      contract_id?: string
      work_order_template?: Record<string, unknown>
      description?: string
    }

    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    if (!body.cron_expression || typeof body.cron_expression !== 'string') {
      return NextResponse.json({ error: 'cron_expression is required' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase
      .from('scheduled_jobs')
      .insert({
        user_id: auth.userId,
        name: body.name.trim(),
        cron_expression: body.cron_expression.trim(),
        agent_id: body.agent_id ?? null,
        repo_id: body.repo_id ?? null,
        contract_id: body.contract_id ?? null,
        work_order_template: body.work_order_template ?? {},
        description: body.description ?? null,
        enabled: true,
      })
      .select()
      .single()

    if (error) {
      console.error('[v1/jobs POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ job: data }, { status: 201 })
  } catch (err) {
    console.error('[v1/jobs POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
