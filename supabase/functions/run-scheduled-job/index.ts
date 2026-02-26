import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getServiceClient, getLicense, isFeatureEnabled } from '../_shared/supabase.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { job_id } = await req.json()
    if (!job_id) {
      return new Response(JSON.stringify({ error: 'job_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const license = await getLicense()
    if (!isFeatureEnabled(license, 'scheduled_jobs')) {
      return new Response(
        JSON.stringify({ error: 'feature_not_available', required_tier: 'pro', upgrade_url: 'https://www.chytr.ai/pricing' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = getServiceClient()

    const { data: job } = await supabase
      .from('scheduled_jobs')
      .select('*')
      .eq('id', job_id)
      .single()

    if (!job || !job.enabled) {
      return new Response(JSON.stringify({ ok: true, skipped: 'job not found or disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const template = job.work_order_template as Record<string, unknown>

    const { data: jobRun } = await supabase
      .from('job_runs')
      .insert({ job_id, status: 'running' })
      .select()
      .single()

    const { data: workOrder, error: woError } = await supabase
      .from('work_orders')
      .insert({
        ...template,
        agent_id: job.agent_id,
        repo_id: job.repo_id,
        source: 'job',
        status: 'pending',
        metadata: { job_id, job_run_id: jobRun?.id },
      })
      .select()
      .single()

    if (woError) throw woError

    if (jobRun) {
      await supabase.from('job_runs').update({
        work_order_id: workOrder.id,
      }).eq('id', jobRun.id)
    }

    await supabase.from('scheduled_jobs').update({
      last_run_at: new Date().toISOString(),
    }).eq('id', job_id)

    return new Response(
      JSON.stringify({ ok: true, work_order_id: workOrder.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
