import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/api-auth'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { loadLicenseFromDB, isFeatureEnabled } from '@/lib/license'
import { launchAgent } from '@/lib/services/launch-agent'

export async function POST(req: NextRequest) {
  const auth = await validateApiKey(req)
  if (!auth.valid) return auth.response!

  try {
    const body = await req.json()
    const { job_id } = body

    if (!job_id) {
      return NextResponse.json({ error: 'job_id required' }, { status: 400 })
    }

    await loadLicenseFromDB()
    if (!isFeatureEnabled('scheduled_jobs')) {
      return NextResponse.json(
        { error: 'feature_not_available', required_tier: 'pro' },
        { status: 403 }
      )
    }

    const supabase = createSupabaseServiceClient()

    const { data: job } = await supabase
      .from('scheduled_jobs')
      .select('*')
      .eq('id', job_id)
      .single()

    if (!job || !job.enabled) {
      return NextResponse.json({ ok: true, skipped: 'job not found or disabled' })
    }

    const template = (job.work_order_template ?? {}) as Record<string, unknown>

    const { data: jobRun } = await supabase
      .from('job_runs')
      .insert({ job_id, status: 'running', started_at: new Date().toISOString() })
      .select()
      .single()

    const { data: workOrder, error: woError } = await supabase
      .from('work_orders')
      .insert({
        agent_id: job.agent_id,
        repo_id: job.repo_id,
        source: 'job',
        objective: typeof template.objective === 'string' ? template.objective : null,
        lines: template.lines ?? null,
        constraints: template.constraints ?? null,
        status: 'pending',
        metadata: { job_id, job_run_id: jobRun?.id ?? null },
      })
      .select()
      .single()

    if (woError) throw woError

    if (jobRun) {
      await supabase
        .from('job_runs')
        .update({ work_order_id: workOrder.id })
        .eq('id', jobRun.id)
    }

    await supabase
      .from('scheduled_jobs')
      .update({ last_run_at: new Date().toISOString() })
      .eq('id', job_id)

    const launchResult = await launchAgent(workOrder.id)
    if (!launchResult.ok && !launchResult.skipped) {
      console.error('[v1/jobs/cron] launch error for job', job_id, launchResult.error)
    }

    return NextResponse.json({ ok: true, work_order_id: workOrder.id })
  } catch (err) {
    console.error('[v1/jobs/cron] unexpected error', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
