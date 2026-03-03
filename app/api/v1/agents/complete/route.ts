import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import { authenticateApiKey } from '@/lib/api-auth'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateApiKey(req)
    if (!auth) {
      return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
    }

    const body = (await req.json()) as {
      chyt_id?: string
      cursor_agent_id?: string
      status?: string
      pr_url?: string
      summary?: string
      error_message?: string
    }

    const chyt_id = body.chyt_id
    if (!chyt_id) {
      return NextResponse.json({ error: 'chyt_id required' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()

    const update: Record<string, unknown> = {
      status: body.status ?? 'completed',
      finished_at: new Date().toISOString(),
    }
    if (body.pr_url) update.pr_url = body.pr_url
    if (body.summary) update.summary = body.summary
    if (body.error_message) update.error_message = body.error_message

    if (body.cursor_agent_id) {
      const { data: config } = await supabase
        .from('instance_config')
        .select('value')
        .eq('key', 'CURSOR_API_KEY')
        .single()
      const cursorApiKey = (config?.value as string) || process.env.CURSOR_API_KEY
      if (cursorApiKey) {
        const agentData = await fetchCursorAgentData(cursorApiKey, body.cursor_agent_id)
        if (agentData) {
          if (agentData.tokens_input != null) update.tokens_input = agentData.tokens_input
          if (agentData.tokens_output != null) update.tokens_output = agentData.tokens_output
          if (agentData.total_cost != null) update.total_cost = agentData.total_cost
          if (agentData.model) update.model = agentData.model
          if (agentData.duration_ms != null) update.duration_ms = agentData.duration_ms
        }
      }
    }

    const { error: updateError } = await supabase
      .from('chyts')
      .update(update)
      .eq('id', chyt_id)
      .eq('user_id', auth.userId)

    if (updateError) {
      console.error('[v1/agents/complete] update', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    const { data: wo } = await supabase
      .from('chyts')
      .select('source, metadata, agent_id')
      .eq('id', chyt_id)
      .eq('user_id', auth.userId)
      .single()

    const effectiveStatus = body.status ?? 'completed'
    if (effectiveStatus !== 'failed' && body.summary) {
      extractKnowledge(
        chyt_id,
        body.summary,
        (wo as { agent_id?: string })?.agent_id,
        auth.userId
      ).catch((e) => console.error('[v1/agents/complete] extractKnowledge', e))
    }

    if (wo && (wo as { source?: string }).source === 'job' && (wo as { metadata?: unknown }).metadata) {
      const meta = (wo as { metadata: Record<string, unknown> }).metadata
      if (meta.job_run_id) {
        await supabase
          .from('job_runs')
          .update({
            status: body.status === 'failed' ? 'failed' : 'completed',
            finished_at: new Date().toISOString(),
          })
          .eq('id', meta.job_run_id)
          .eq('user_id', auth.userId)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[v1/agents/complete]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

async function fetchCursorAgentData(
  apiKey: string,
  agentId: string
): Promise<{
  tokens_input?: number
  tokens_output?: number
  total_cost?: number
  model?: string
  duration_ms?: number
} | null> {
  try {
    const res = await fetch(`https://api.cursor.com/v1/agents/${agentId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    if (!res.ok) return null
    return (await res.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

async function extractKnowledge(
  workOrderId: string,
  summary: string,
  agentId: string | undefined,
  userId: string
) {
  let agentType: string | null = null
  if (agentId) {
    const supabase = createSupabaseServiceClient()
    const { data: agent } = await supabase
      .from('agents')
      .select('name')
      .eq('id', agentId)
      .eq('user_id', userId)
      .single()
    if (agent?.name) agentType = agent.name
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/embed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({
      text: summary,
      chyt_id: workOrderId,
      agent_type: agentType,
      user_id: userId,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err)
  }
}
