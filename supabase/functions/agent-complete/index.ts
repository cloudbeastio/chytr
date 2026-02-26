import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getServiceClient } from '../_shared/supabase.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { work_order_id, cursor_agent_id, status, pr_url, summary, error_message } = body

    if (!work_order_id) {
      return new Response(JSON.stringify({ error: 'work_order_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = getServiceClient()

    const update: Record<string, unknown> = {
      status: status ?? 'completed',
      finished_at: new Date().toISOString(),
    }
    if (pr_url) update.pr_url = pr_url
    if (summary) update.summary = summary
    if (error_message) update.error_message = error_message

    if (cursor_agent_id) {
      const cursorApiKey = Deno.env.get('CURSOR_API_KEY')
      if (cursorApiKey) {
        const agentData = await fetchCursorAgentData(cursorApiKey, cursor_agent_id)
        if (agentData) {
          if (agentData.tokens_input) update.tokens_input = agentData.tokens_input
          if (agentData.tokens_output) update.tokens_output = agentData.tokens_output
          if (agentData.total_cost) update.total_cost = agentData.total_cost
          if (agentData.model) update.model = agentData.model
          if (agentData.duration_ms) update.duration_ms = agentData.duration_ms
        }
      }
    }

    await supabase.from('work_orders').update(update).eq('id', work_order_id)

    const { data: wo } = await supabase
      .from('work_orders')
      .select('source, metadata')
      .eq('id', work_order_id)
      .single()

    if (wo?.source === 'job' && wo.metadata) {
      const meta = wo.metadata as Record<string, unknown>
      if (meta.job_run_id) {
        await supabase.from('job_runs').update({
          status: status === 'failed' ? 'failed' : 'completed',
          finished_at: new Date().toISOString(),
        }).eq('id', meta.job_run_id)
      }
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function fetchCursorAgentData(apiKey: string, agentId: string) {
  try {
    const res = await fetch(`https://api.cursor.com/v1/agents/${agentId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}
