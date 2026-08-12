import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { authenticateApiKey } from '@/lib/api-auth'
import { normalizePayload, checkDefinitionOfDone } from '@/lib/ingest-helpers'
import { normalizeRepoUrl } from '@/lib/repo-utils'
import { resolveCbmain, resolveConversationId } from '@/lib/cbmain-contract'

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
  'preCompact',
  'pre_compact',
  'stop',
] as const

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateApiKey(req)
    if (!auth) {
      return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
    }

    const body = (await req.json()) as {
      event_type?: string
      chyt_id?: string
      /** @deprecated back-compat: hook scripts historically sent `work_order_id` */
      work_order_id?: string
      agent_id?: string
      source_repo?: string
      /** Runtime run id (bc-… / session_…) — preferred top-level stamp */
      conversation_id?: string
      runtime_run_id?: string
      /** cb-main breadcrumb block (payload.cbmain) */
      cbmain?: Record<string, unknown>
      raw_payload?: Record<string, unknown>
    }

    const event_type = body.event_type
    // Back-compat: the API renamed `work_order_id` → `chyt_id`, but already-installed
    // hook scripts may still send the old key. Accept either so logs aren't orphaned.
    const chytId = body.chyt_id ?? body.work_order_id ?? null
    if (!event_type || typeof event_type !== 'string') {
      return NextResponse.json({ error: 'event_type required' }, { status: 400 })
    }
    if (!VALID_EVENT_TYPES.includes(event_type as (typeof VALID_EVENT_TYPES)[number])) {
      return NextResponse.json({ error: 'Invalid event_type' }, { status: 400 })
    }

    const rawPayload = body.raw_payload ?? {}
    const conversationId = resolveConversationId({
      bodyConversationId: body.conversation_id,
      bodyRuntimeRunId: body.runtime_run_id,
      rawPayload,
      envRuntimeRunId: process.env.CHYTR_RUNTIME_RUN_ID ?? null,
    })
    const cbmain = resolveCbmain({
      conversationId,
      bodyCbmain: body.cbmain,
      rawPayload,
      envCbmainJson: process.env.CHYTR_CBMAIN_JSON ?? null,
    })

    const supabase = createSupabaseServiceClient()
    const payload = normalizePayload(event_type, rawPayload, {
      conversationId,
      cbmain,
    })
    const repo = body.source_repo ? normalizeRepoUrl(body.source_repo) : null

    const eventTypeForDb =
      event_type === 'preCompact' ? 'pre_compact' : event_type
    const model = (payload.model as string) ?? null

    const { error: insertError } = await supabase.from('agent_logs').insert({
      user_id: auth.userId,
      chyt_id: chytId,
      agent_id: body.agent_id ?? null,
      event_type: eventTypeForDb,
      payload,
      source_repo: repo?.url ?? null,
      source_repo_name: repo?.name ?? null,
      model,
      conversation_id: conversationId,
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
    if (event_type === 'session_end' && chytId) {
      followup_message = await checkDefinitionOfDone(
        supabase,
        chytId,
        payload
      )

      const status = (body.raw_payload?.status === 'failed') ? 'failed' : 'completed'
      const durationMs = payload.duration_ms != null ? Number(payload.duration_ms) : null
      const modelFromPayload = (payload.model as string) ?? null
      const update: Record<string, unknown> = {
        status,
        finished_at: new Date().toISOString(),
      }
      if (modelFromPayload != null) update.model = modelFromPayload
      if (durationMs != null) update.duration_ms = durationMs

      await supabase
        .from('chyts')
        .update(update)
        .eq('id', chytId)
        .eq('user_id', auth.userId)
    }

    return NextResponse.json({
      ok: true,
      followup_message,
      conversation_id: conversationId,
      cbmain_stamped: Boolean(cbmain),
    })
  } catch (err) {
    console.error('[v1/ingest]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
