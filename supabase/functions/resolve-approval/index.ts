import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getServiceClient, getLicense, isFeatureEnabled } from '../_shared/supabase.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { approval_id, decision, decided_by } = body

    if (!approval_id) {
      return new Response(JSON.stringify({ error: 'approval_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    if (!decision) {
      return new Response(JSON.stringify({ error: 'decision required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const license = await getLicense()
    if (!isFeatureEnabled(license, 'approvals')) {
      return new Response(
        JSON.stringify({ error: 'feature_not_available', required_tier: 'pro', upgrade_url: 'https://www.chytr.ai/pricing' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = getServiceClient()

    const { data: approval, error: fetchError } = await supabase
      .from('approvals')
      .select('id, status, options')
      .eq('id', approval_id)
      .single()

    if (fetchError || !approval) {
      return new Response(JSON.stringify({ error: 'approval not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (approval.status !== 'pending') {
      return new Response(
        JSON.stringify({ error: 'approval already resolved', status: approval.status }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate decision is one of the allowed options (if options are defined)
    const options = approval.options as string[] | null
    if (options && options.length > 0 && !options.includes(decision)) {
      return new Response(
        JSON.stringify({ error: 'invalid decision', allowed: options }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { error: updateError } = await supabase
      .from('approvals')
      .update({
        status: 'resolved',
        decision,
        decided_by: decided_by ?? null,
        decided_at: new Date().toISOString(),
      })
      .eq('id', approval_id)

    if (updateError) throw updateError

    return new Response(
      JSON.stringify({ ok: true, approval_id, decision }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
