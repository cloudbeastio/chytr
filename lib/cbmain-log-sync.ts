import { redactAgentLogRow, scrubCredentials } from '@/lib/mcp/redact'

const SYNC_TIMEOUT_MS = 4_000
const PAYLOAD_MAX_CHARS = 64_000
const CURSOR_KEY = 'cbmain_log_sync_cursor'

export type AgentLogRow = {
  id: string
  chyt_id?: string | null
  agent_id?: string | null
  event_type: string
  payload?: Record<string, unknown> | null
  sequence_number?: number | null
  model?: string | null
  conversation_id?: string | null
  source_repo?: string | null
  source_repo_name?: string | null
  created_at: string
}

export type CbmainLogMirror = {
  chytr_log_id: string
  conversation_id: string | null
  chyt_id: string | null
  event_type: string
  payload: Record<string, unknown>
  model: string | null
  source_repo_name: string | null
  created_at: string
  cbmain: Record<string, unknown> | null
}

export function canonicalRepoName(name: string | null | undefined): string | null {
  if (!name) return null
  const scrubbed = scrubCredentials(String(name).trim())
  if (!scrubbed) return null
  const m = scrubbed.match(/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)(?:\.git)?$/)
  return m ? m[1] : scrubbed
}

function capPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const json = JSON.stringify(payload)
  if (json.length <= PAYLOAD_MAX_CHARS) return payload
  return {
    _truncated: true,
    _original_chars: json.length,
    preview: json.slice(0, PAYLOAD_MAX_CHARS),
  }
}

export function toMirrorRow(row: AgentLogRow): CbmainLogMirror {
  const redacted = redactAgentLogRow({
    ...row,
    source_repo: null,
    payload: row.payload ?? {},
  })
  const payload = capPayload(
    (redacted.payload && typeof redacted.payload === 'object'
      ? (redacted.payload as Record<string, unknown>)
      : {}) as Record<string, unknown>
  )
  const cbmain =
    payload.cbmain && typeof payload.cbmain === 'object' && !Array.isArray(payload.cbmain)
      ? (payload.cbmain as Record<string, unknown>)
      : null
  return {
    chytr_log_id: row.id,
    conversation_id: row.conversation_id ?? null,
    chyt_id: row.chyt_id ?? null,
    event_type: row.event_type,
    payload,
    model: row.model ?? null,
    source_repo_name: canonicalRepoName(row.source_repo_name),
    created_at: row.created_at,
    cbmain,
  }
}

export function syncEnv(): { url: string; key: string } | null {
  const url = (process.env.CBMAIN_LOG_SYNC_URL ?? '').trim().replace(/\/+$/, '')
  const key = (process.env.CBMAIN_LOG_SYNC_KEY ?? '').trim()
  if (!url || !key) return null
  return { url, key }
}

export async function pushLogsToCbmain(rows: AgentLogRow[]): Promise<{
  ok: boolean
  skipped?: 'env_unset' | 'empty'
  error?: string
  upserted?: number
}> {
  if (rows.length === 0) return { ok: true, skipped: 'empty', upserted: 0 }
  const env = syncEnv()
  if (!env) return { ok: false, skipped: 'env_unset', error: 'CBMAIN_LOG_SYNC_URL/KEY unset' }

  const logs = rows.map(toMirrorRow)
  try {
    const res = await fetch(env.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-chytr-sync-key': env.key,
      },
      body: JSON.stringify({ logs }),
      signal: AbortSignal.timeout(SYNC_TIMEOUT_MS),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, error: `cb-main sync HTTP ${res.status} ${text.slice(0, 200)}` }
    }
    const body = (await res.json().catch(() => ({}))) as { upserted?: number }
    return { ok: true, upserted: body.upserted ?? logs.length }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'cb-main sync failed',
    }
  }
}

export function syncOneLog(row: AgentLogRow): void {
  void pushLogsToCbmain([row]).then((r) => {
    if (!r.ok && r.skipped !== 'env_unset') {
      console.error('[cbmain-log-sync] live push failed', r.error)
    }
  })
}

export { CURSOR_KEY }
