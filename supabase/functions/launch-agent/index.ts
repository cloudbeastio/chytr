import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { getServiceClient, getLicense } from '../_shared/supabase.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    // DB webhook sends { type: 'INSERT', record: {...} }
    const workOrder = body.record ?? body

    if (!workOrder?.id) {
      return new Response(JSON.stringify({ error: 'No work order data' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (workOrder.source === 'local') {
      return new Response(JSON.stringify({ ok: true, skipped: 'local source' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const license = await getLicense()
    if (!license) {
      return new Response(JSON.stringify({ error: 'No valid license' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = getServiceClient()
    const cursorApiKey = Deno.env.get('CURSOR_API_KEY')
    if (!cursorApiKey) {
      throw new Error('CURSOR_API_KEY not configured')
    }

    const { data: wo } = await supabase.rpc('get_work_order', { p_work_order_id: workOrder.id })
    if (!wo) throw new Error('Work order not found')

    const prompt = buildAgentPrompt(wo)

    const cursorRes = await fetch('https://api.cursor.com/v1/agents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cursorApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        repo_url: wo.repo_url,
        branch: wo.branch_name ?? wo.default_branch ?? 'main',
      }),
    })

    if (!cursorRes.ok) {
      const errText = await cursorRes.text()
      throw new Error(`Cursor API error: ${cursorRes.status} ${errText}`)
    }

    const cursorData = await cursorRes.json()

    await supabase.from('work_orders').update({
      status: 'running',
      cursor_agent_id: cursorData.id ?? cursorData.agent_id,
    }).eq('id', workOrder.id)

    return new Response(
      JSON.stringify({ ok: true, cursor_agent_id: cursorData.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('launch-agent error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function buildAgentPrompt(wo: Record<string, unknown>): string {
  const lines = Array.isArray(wo.lines) ? wo.lines : []
  const linesList = lines.map((l: Record<string, unknown>, i: number) =>
    `${i + 1}. ${l.title}${l.definition_of_done ? ` — DoD: ${l.definition_of_done}` : ''}`
  ).join('\n')

  return `WORK_ORDER_ID=${wo.id}

## Objective
${wo.objective ?? 'See work order lines below'}

## Work Order Lines
${linesList || 'Complete the objective above'}

${wo.constraints && Object.keys(wo.constraints as object).length ? `## Constraints\n${JSON.stringify(wo.constraints, null, 2)}\n` : ''}
${wo.exploration_hints && Object.keys(wo.exploration_hints as object).length ? `## Exploration Hints\n${JSON.stringify(wo.exploration_hints, null, 2)}\n` : ''}
${wo.verification && Object.keys(wo.verification as object).length ? `## Verification\n${JSON.stringify(wo.verification, null, 2)}\n` : ''}

## Instructions
1. Start by reading your work order: the WORK_ORDER_ID above is ${wo.id}
2. The chytr hooks skill is installed in this repo — your actions are being logged automatically
3. Complete each work order line in order
4. When done, create a PR if applicable
`.trim()
}
