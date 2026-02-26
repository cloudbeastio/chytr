import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getServiceClient, getLicense } from '../_shared/supabase.ts'

// deno-lint-ignore no-explicit-any
declare const Supabase: any

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { text, work_order_id, agent_type } = await req.json()
    if (!text) {
      return new Response(JSON.stringify({ error: 'text required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = getServiceClient()
    const license = await getLicense()

    if (license?.limits?.knowledge_entries) {
      const { count } = await supabase
        .from('knowledge')
        .select('*', { count: 'exact', head: true })

      if ((count ?? 0) >= license.limits.knowledge_entries) {
        return new Response(
          JSON.stringify({ error: 'knowledge_limit_exceeded', limit: license.limits.knowledge_entries }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    const session = new Supabase.ai.Session('gte-small')
    const { data: embedding } = await session.run(text, { mean_pool: true, normalize: true })

    const { data: knowledgeId, error } = await supabase.rpc('upsert_knowledge', {
      p_learning: text,
      p_embedding: embedding,
      p_work_order_id: work_order_id ?? null,
      p_agent_type: agent_type ?? null,
    })

    if (error) throw error

    return new Response(
      JSON.stringify({ ok: true, knowledge_id: knowledgeId, embedding }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
