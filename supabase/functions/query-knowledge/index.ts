import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getServiceClient } from '../_shared/supabase.ts'

// deno-lint-ignore no-explicit-any
declare const Supabase: any

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    let query: string
    let agent_type: string | null = null
    let match_count = 5

    if (req.method === 'POST') {
      const body = await req.json()
      query = body.query
      agent_type = body.agent_type ?? null
      match_count = body.match_count ?? 5
    } else {
      query = url.searchParams.get('query') ?? ''
      agent_type = url.searchParams.get('agent_type')
      const workOrderId = url.searchParams.get('work_order_id')
      if (workOrderId && !query) {
        const supabase = getServiceClient()
        const { data: wo } = await supabase
          .from('work_orders')
          .select('objective')
          .eq('id', workOrderId)
          .single()
        query = wo?.objective ?? ''
      }
    }

    if (!query) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const session = new Supabase.ai.Session('gte-small')
    const { data: embedding } = await session.run(query, { mean_pool: true, normalize: true })

    const supabase = getServiceClient()
    const { data: results, error } = await supabase.rpc('match_knowledge', {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count,
      p_agent_type: agent_type,
    })

    if (error) throw error

    const formatted = (results ?? []).map((r: Record<string, unknown>) => r.learning).join('\n\n')

    return new Response(
      JSON.stringify({ results: results ?? [], formatted }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
