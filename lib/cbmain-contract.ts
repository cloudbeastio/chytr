/**
 * P0 correlation contract (2026-08-12 design):
 * join key = runtime run id (external_run_id ↔ agent_logs.conversation_id ↔
 * ops.work_items.chyt_id legacy misnomer).
 * metadata.cbmain / payload.cbmain = breadcrumbs only — cb-main remains SoT.
 */

export interface CbmainBreadcrumb {
  runtime_run_id: string
  work_item_id?: string | null
  work_item_short_id?: string | null
  task_id?: string | null
  task_short_id?: string | null
  project_id?: string | null
  source_kind?: string | null
  source_ref?: string | null
  repo?: string | null
  branch?: string | null
  session_url?: string | null
  lane?: string | null
}

const RUN_ID_KEYS = [
  'conversation_id',
  'runtime_run_id',
  'external_run_id',
  'session_id',
  'composer_id',
] as const

function asNonEmptyString(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length > 0 ? t : null
}

function pickRunIdFromRecord(rec: Record<string, unknown> | null | undefined): string | null {
  if (!rec) return null
  for (const k of RUN_ID_KEYS) {
    const v = asNonEmptyString(rec[k])
    if (v) return v
  }
  const nested = rec.cbmain
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const fromCb = asNonEmptyString((nested as Record<string, unknown>).runtime_run_id)
    if (fromCb) return fromCb
  }
  return null
}

/** Parse CHYTR_CBMAIN_JSON env (hooks) — invalid JSON → null. */
export function parseCbmainJson(raw: string | null | undefined): Partial<CbmainBreadcrumb> | null {
  if (!raw || !raw.trim()) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as Partial<CbmainBreadcrumb>
  } catch {
    return null
  }
}

/**
 * Resolve correlation run id from ingest body + raw hook payload + env.
 * Prefer explicit top-level body fields, then payload, then env.
 */
export function resolveConversationId(opts: {
  bodyConversationId?: unknown
  bodyRuntimeRunId?: unknown
  rawPayload?: Record<string, unknown> | null
  envRuntimeRunId?: string | null
}): string | null {
  return (
    asNonEmptyString(opts.bodyConversationId) ??
    asNonEmptyString(opts.bodyRuntimeRunId) ??
    pickRunIdFromRecord(opts.rawPayload ?? undefined) ??
    asNonEmptyString(opts.envRuntimeRunId) ??
    null
  )
}

/**
 * Merge cbmain breadcrumbs. Explicit body wins over raw payload over env JSON.
 * Always stamps runtime_run_id when conversationId is known.
 */
export function resolveCbmain(opts: {
  conversationId: string | null
  bodyCbmain?: unknown
  rawPayload?: Record<string, unknown> | null
  envCbmainJson?: string | null
}): CbmainBreadcrumb | null {
  const fromBody =
    opts.bodyCbmain && typeof opts.bodyCbmain === 'object' && !Array.isArray(opts.bodyCbmain)
      ? (opts.bodyCbmain as Partial<CbmainBreadcrumb>)
      : null
  const fromRaw =
    opts.rawPayload?.cbmain &&
    typeof opts.rawPayload.cbmain === 'object' &&
    !Array.isArray(opts.rawPayload.cbmain)
      ? (opts.rawPayload.cbmain as Partial<CbmainBreadcrumb>)
      : null
  const fromEnv = parseCbmainJson(opts.envCbmainJson)

  const merged: Partial<CbmainBreadcrumb> = {
    ...(fromEnv ?? {}),
    ...(fromRaw ?? {}),
    ...(fromBody ?? {}),
  }

  const runtime_run_id =
    asNonEmptyString(merged.runtime_run_id) ?? opts.conversationId

  if (!runtime_run_id) return null

  return {
    runtime_run_id,
    work_item_id: asNonEmptyString(merged.work_item_id) ?? null,
    work_item_short_id: asNonEmptyString(merged.work_item_short_id) ?? null,
    task_id: asNonEmptyString(merged.task_id) ?? null,
    task_short_id: asNonEmptyString(merged.task_short_id) ?? null,
    project_id: asNonEmptyString(merged.project_id) ?? null,
    source_kind: asNonEmptyString(merged.source_kind) ?? null,
    source_ref: asNonEmptyString(merged.source_ref) ?? null,
    repo: asNonEmptyString(merged.repo) ?? null,
    branch: asNonEmptyString(merged.branch) ?? null,
    session_url: asNonEmptyString(merged.session_url) ?? null,
    lane: asNonEmptyString(merged.lane) ?? null,
  }
}
