import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/api-auth'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { launchAgent } from '@/lib/services/launch-agent'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(req)
  if (!auth.valid) return auth.response!

  try {
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

    const { data: jobRun, error: runInsertError } = await supabase
      .from('job_runs')
      .insert({ job_id: job.id, status: 'running', started_at: new Date().toISOString() })
      .select()
      .single()

    if (runInsertError) {
      console.error('[v1/jobs/run/POST] job_run insert error', runInsertError)
    }

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
        metadata: { job_id: job.id, job_run_id: jobRun?.id ?? null },
      })
      .select()
      .single()

    if (woError || !workOrder) {
      console.error('[v1/jobs/run/POST] work order error', woError)
      return NextResponse.json(
        { error: woError?.message ?? 'Failed to create work order' },
        { status: 500 }
      )
    }

    if (jobRun) {
      await supabase
        .from('job_runs')
        .update({ work_order_id: workOrder.id })
        .eq('id', jobRun.id)
    }

    await supabase
      .from('scheduled_jobs')
      .update({ last_run_at: new Date().toISOString() })
      .eq('id', id)

    const launchResult = await launchAgent(workOrder.id)
    if (!launchResult.ok && !launchResult.skipped) {
      console.error('[v1/jobs/run/POST] launch error', launchResult.error)
    }

    return NextResponse.json(
      {
        ok: true,
        work_order_id: workOrder.id,
        cursor_agent_id: launchResult.cursor_agent_id ?? null,
        launch_error: launchResult.ok ? null : (launchResult.error ?? null),
      },
      { status: 201 }
    )
  } catch (err) {
    console.error('[v1/jobs/run/POST] unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
