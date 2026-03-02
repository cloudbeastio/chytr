import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import { authenticateApiKey } from '@/lib/api-auth'
import { normalizePayload, checkDefinitionOfDone } from '@/lib/ingest-helpers'

const VALID_EVENT_TYPES = [
  'session_start',
  'tool_call',
  'tool_result',
  'tool_failure',
  'shell_execution',
  'file_edit',
  'mcp_execution',
  'skill_load',
  'agent_thought',
  'agent_response',
  'subagent_start',
  'subagent_stop',
  'approval_requested',
  'error',
  'session_end',
] as const

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateApiKey(req)
    if (!auth) {
      return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
    }

    const body = (await req.json()) as {
      event_type?: string
      work_order_id?: string
      agent_id?: string
      raw_payload?: Record<string, unknown>
    }

    const event_type = body.event_type
    if (!event_type || typeof event_type !== 'string') {
      return NextResponse.json({ error: 'event_type required' }, { status: 400 })
    }
    if (!VALID_EVENT_TYPES.includes(event_type as (typeof VALID_EVENT_TYPES)[number])) {
      return NextResponse.json({ error: 'Invalid event_type' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()
    const payload = normalizePayload(event_type, body.raw_payload ?? {})

    const { error: insertError } = await supabase.from('agent_logs').insert({
      user_id: auth.userId,
      work_order_id: body.work_order_id ?? null,
      agent_id: body.agent_id ?? null,
      event_type,
      payload,
    })

    if (insertError) {
      console.error('[v1/ingest] insert', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    if (body.agent_id) {
      await supabase
        .from('agents')
        .update({
          last_heartbeat: new Date().toISOString(),
          status: 'active',
        })
        .eq('id', body.agent_id)
        .eq('user_id', auth.userId)
    }

    let followup_message: string | null = null
    if (event_type === 'session_end' && body.work_order_id) {
      followup_message = await checkDefinitionOfDone(
        supabase,
        body.work_order_id,
        payload
      )

      const status = (body.raw_payload?.status === 'failed') ? 'failed' : 'completed'
      await supabase
        .from('work_orders')
        .update({
          status,
          finished_at: new Date().toISOString(),
        })
        .eq('id', body.work_order_id)
        .eq('user_id', auth.userId)
    }

    return NextResponse.json({ ok: true, followup_message })
  } catch (err) {
    console.error('[v1/ingest]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
