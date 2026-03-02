import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { getSessionUserId } from '@/lib/session'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const supabase = createSupabaseServiceClient()

    const { data: job, error: jobError } = await supabase
      .from('scheduled_jobs')
      .select('*')
      .eq('id', id)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const template = (job.work_order_template ?? {}) as Record<string, unknown>

    const { data: workOrder, error: woError } = await supabase
      .from('work_orders')
      .insert({
        agent_id: job.agent_id ?? null,
        repo_id: job.repo_id ?? null,
        source: 'job',
        objective: typeof template.objective === 'string' ? template.objective : null,
        lines: template.lines ?? null,
        constraints: template.constraints ?? null,
        status: 'pending',
        user_id: userId,
      })
      .select()
      .single()

    if (woError || !workOrder) {
      console.error('[jobs/run/POST] work order error', woError)
      return NextResponse.json({ error: woError?.message ?? 'Failed to create work order' }, { status: 500 })
    }

    const now = new Date().toISOString()

    const [{ error: runError }] = await Promise.all([
      supabase.from('job_runs').insert({
        job_id: job.id,
        work_order_id: workOrder.id,
        status: 'pending',
        started_at: now,
      }),
      supabase.from('scheduled_jobs').update({ last_run_at: now }).eq('id', id),
    ])

    if (runError) {
      console.error('[jobs/run/POST] job run insert error', runError)
    }

    return NextResponse.json({ ok: true, work_order_id: workOrder.id }, { status: 201 })
  } catch (err) {
    console.error('[jobs/run/POST] unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
