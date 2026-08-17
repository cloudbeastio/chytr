import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { authenticateApiKey } from '@/lib/api-auth'
import {
  CURSOR_KEY,
  pushLogsToCbmain,
  syncEnv,
  type AgentLogRow,
} from '@/lib/cbmain-log-sync'

const DEFAULT_BATCH = 200
const MAX_BATCH = 500
const DEFAULT_MAX_BATCHES = 20
const MAX_BATCHES = 50

type Cursor = { created_at: string; id: string }

function parseCursor(raw: string | null): Cursor | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Cursor
    if (typeof parsed.created_at === 'string' && typeof parsed.id === 'string') {
      return parsed
    }
  } catch {
    /* ignore */
  }
  return null
}

function asInt(v: unknown, fallback: number, max: number): number {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10)
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.min(Math.floor(n), max)
}

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req)
  if (!auth) {
    return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
  }

  const supabase = createSupabaseServiceClient()
  const { data: cursorRow } = await supabase
    .from('instance_config')
    .select('value, updated_at')
    .eq('key', CURSOR_KEY)
    .maybeSingle()

  const env = syncEnv()
  return NextResponse.json({
    ok: true,
    sync_configured: Boolean(env),
    cursor: parseCursor(cursorRow?.value ?? null),
    cursor_updated_at: cursorRow?.updated_at ?? null,
  })
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateApiKey(req)
    if (!auth) {
      return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
    }
    if (!syncEnv()) {
      return NextResponse.json(
        { error: 'CBMAIN_LOG_SYNC_URL/KEY unset' },
        { status: 503 }
      )
    }

    const body = (await req.json().catch(() => ({}))) as {
      batch_size?: number
      max_batches?: number
      repo?: string
      reset?: boolean
    }
    const batchSize = asInt(body.batch_size, DEFAULT_BATCH, MAX_BATCH)
    const maxBatches = asInt(body.max_batches, DEFAULT_MAX_BATCHES, MAX_BATCHES)
    const repoFilter =
      typeof body.repo === 'string' && body.repo.trim() ? body.repo.trim() : null

    const supabase = createSupabaseServiceClient()
    if (body.reset) {
      await supabase.from('instance_config').delete().eq('key', CURSOR_KEY)
    }

    const { data: cursorRow } = await supabase
      .from('instance_config')
      .select('value')
      .eq('key', CURSOR_KEY)
      .maybeSingle()
    let cursor = parseCursor(cursorRow?.value ?? null)

    let pushed = 0
    let batches = 0
    let lastError: string | null = null
    let done = false

    for (let i = 0; i < maxBatches; i++) {
      let query = supabase
        .from('agent_logs')
        .select(
          'id, chyt_id, agent_id, event_type, payload, sequence_number, model, conversation_id, source_repo_name, created_at'
        )
        .eq('user_id', auth.userId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .limit(batchSize)

      if (cursor) {
        const ts = cursor.created_at
        query = query.or(
          `created_at.gt."${ts}",and(created_at.eq."${ts}",id.gt.${cursor.id})`
        )
      }
      if (repoFilter) {
        query = query.ilike('source_repo_name', `%${repoFilter}%`)
      }

      const { data, error } = await query
      if (error) {
        lastError = error.message
        break
      }
      const rows = (data ?? []) as AgentLogRow[]
      if (rows.length === 0) {
        done = true
        break
      }

      const result = await pushLogsToCbmain(rows)
      if (!result.ok) {
        lastError = result.error ?? 'sync failed'
        break
      }

      const last = rows[rows.length - 1]
      cursor = { created_at: last.created_at, id: last.id }
      await supabase.from('instance_config').upsert({
        key: CURSOR_KEY,
        value: JSON.stringify(cursor),
        updated_at: new Date().toISOString(),
      })

      pushed += result.upserted ?? rows.length
      batches += 1
      if (rows.length < batchSize) {
        done = true
        break
      }
    }

    return NextResponse.json({
      ok: !lastError,
      pushed,
      batches,
      done,
      cursor,
      error: lastError,
    })
  } catch (err) {
    console.error('[cbmain-sync/backfill]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
