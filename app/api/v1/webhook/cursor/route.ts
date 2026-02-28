import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createSupabaseServiceClient } from '@/lib/supabase'

const CHYTR_API_KEY = process.env.CHYTR_API_KEY ?? ''

interface CursorWebhookPayload {
  event: string
  timestamp: string
  id: string
  status: string
  source?: { repository?: string; ref?: string }
  target?: { url?: string; branchName?: string; prUrl?: string }
  summary?: string
}

function verifySignature(secret: string, rawBody: string, signature: string): boolean {
  if (!secret || !signature) return false
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text()

    const signature = req.headers.get('x-webhook-signature') ?? ''
    if (!verifySignature(CHYTR_API_KEY, rawBody, signature)) {
      console.error('[webhook/cursor] signature verification failed')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    let payload: CursorWebhookPayload
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    if (payload.event !== 'statusChange') {
      return NextResponse.json({ ok: true, ignored: payload.event })
    }

    const cursorAgentId = payload.id
    if (!cursorAgentId) {
      return NextResponse.json({ error: 'Missing agent id' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()

    const { data: wo, error: woError } = await supabase
      .from('work_orders')
      .select('id, source, metadata')
      .eq('cursor_agent_id', cursorAgentId)
      .single()

    if (woError || !wo) {
      console.error('[webhook/cursor] work order not found for agent', cursorAgentId, woError)
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
    }

    const status = payload.status === 'FINISHED' ? 'completed' : 'failed'

    const update: Record<string, unknown> = {
      status,
      finished_at: new Date().toISOString(),
    }

    if (payload.target?.prUrl) update.pr_url = payload.target.prUrl
    if (payload.target?.branchName) update.branch_name = payload.target.branchName
    if (payload.summary) update.summary = payload.summary
    if (status === 'failed' && payload.summary) update.error_message = payload.summary

    await supabase.from('work_orders').update(update).eq('id', wo.id)

    if (wo.source === 'job' && wo.metadata) {
      const meta = wo.metadata as Record<string, unknown>
      if (meta.job_run_id) {
        await supabase
          .from('job_runs')
          .update({
            status: status === 'failed' ? 'failed' : 'completed',
            finished_at: new Date().toISOString(),
          })
          .eq('id', meta.job_run_id)
      }
    }

    console.log('[webhook/cursor] updated work order', wo.id, 'status:', status)
    return NextResponse.json({ ok: true, work_order_id: wo.id, status })
  } catch (err) {
    console.error('[webhook/cursor] unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
