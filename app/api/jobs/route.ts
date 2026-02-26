import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase
      .from('scheduled_jobs')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[jobs/GET] supabase error', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ jobs: data })
  } catch (err) {
    console.error('[jobs/GET] unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, cron_expression, agent_id, repo_id, work_order_template, description } = body

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    if (!cron_expression || typeof cron_expression !== 'string') {
      return NextResponse.json({ error: 'cron_expression is required' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase
      .from('scheduled_jobs')
      .insert({
        name: name.trim(),
        cron_expression: cron_expression.trim(),
        agent_id: agent_id ?? null,
        repo_id: repo_id ?? null,
        work_order_template: work_order_template ?? {},
        description: description ?? null,
        enabled: true,
      })
      .select()
      .single()

    if (error) {
      console.error('[jobs/POST] supabase error', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ job: data }, { status: 201 })
  } catch (err) {
    console.error('[jobs/POST] unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
