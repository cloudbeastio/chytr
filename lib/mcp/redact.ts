/**
 * Mandatory redaction before any MCP/read return of agent_logs.
 * source_repo often embeds live ghs_ GitHub tokens; payload may hold secrets.
 */

const CREDENTIAL_PATTERNS: RegExp[] = [
  /\bghs_[A-Za-z0-9_]{20,}\b/g,
  /\bgho_[A-Za-z0-9_]{20,}\b/g,
  /\bghp_[A-Za-z0-9_]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bchk_[A-Za-z0-9]{16,}\b/g,
  /\bcbpat_[A-Za-z0-9_]{16,}\b/g,
  /\bsk-[A-Za-z0-9]{20,}\b/g,
  /\bxai-[A-Za-z0-9_-]{20,}\b/g,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, // JWT-ish
  /Bearer\s+[A-Za-z0-9\-._~+\/]+=*/gi,
]

const REDACTED = '[REDACTED]'

export function scrubCredentials(text: string): string {
  let out = text
  for (const re of CREDENTIAL_PATTERNS) {
    out = out.replace(re, REDACTED)
  }
  return out
}

function scrubUnknown(value: unknown): unknown {
  if (typeof value === 'string') return scrubCredentials(value)
  if (Array.isArray(value)) return value.map(scrubUnknown)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = scrubUnknown(v)
    }
    return out
  }
  return value
}

/** Redact a single agent_logs row for API/MCP return. */
export function redactAgentLogRow<T extends Record<string, unknown>>(row: T): T {
  const next: Record<string, unknown> = { ...row }

  if ('source_repo' in next) {
    // Never return raw source_repo — may contain embedded ghs_ tokens in URL query/userinfo.
    next.source_repo = next.source_repo
      ? scrubCredentials(String(next.source_repo))
      : null
    // Prefer name-only when present; still scrub.
    if ('source_repo_name' in next && next.source_repo_name != null) {
      next.source_repo_name = scrubCredentials(String(next.source_repo_name))
    }
  }

  if ('payload' in next && next.payload != null) {
    next.payload = scrubUnknown(next.payload)
  }

  return next as T
}

export function redactAgentLogRows<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map(redactAgentLogRow)
}
