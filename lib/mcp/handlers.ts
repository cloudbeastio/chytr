import { createHash } from 'crypto'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { redactAgentLogRows } from '@/lib/mcp/redact'
import type { McpAuthContext } from './scopes'
import { MCP_TOOLS } from './tools'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

export type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string; httpHint?: number }

function asString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined
}

function asLimit(v: unknown, fallback: number, max: number): number {
  const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10)
  if (!Number.isFinite(n) || n < 1) return fallback
  return Math.min(Math.floor(n), max)
}

export async function writeMcpAudit(opts: {
  auth: McpAuthContext
  tool: string
  argsHash: string
  status: 'ok' | 'error'
  durationMs: number
  error?: string | null
}): Promise<void> {
  try {
    const supabase = createSupabaseServiceClient()
    await supabase.from('mcp_audit_log').insert({
      user_id: opts.auth.userId,
      api_key_id: opts.auth.keyId ?? null,
      auth_kind: opts.auth.kind,
      tool: opts.tool,
      args_hash: opts.argsHash,
      status: opts.status,
      duration_ms: opts.durationMs,
      error: opts.error ?? null,
    })
  } catch (err) {
    console.error('[mcp/audit] insert failed', err)
  }
}

export function hashArgs(args: unknown): string {
  return createHash('sha256').update(JSON.stringify(args ?? {}), 'utf8').digest('hex').slice(0, 64)
}

async function chytrLogsList(
  auth: McpAuthContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const conversationId =
    asString(args.conversation_id) ?? asString(args.runtime_run_id)
  if (!conversationId) {
    return { ok: false, error: 'conversation_id or runtime_run_id required', httpHint: 400 }
  }

  const limit = asLimit(args.limit, 100, 500)
  const before = asString(args.before)
  const supabase = createSupabaseServiceClient()

  let query = supabase
    .from('agent_logs')
    .select(
      'id, chyt_id, agent_id, event_type, payload, sequence_number, model, conversation_id, source_repo, source_repo_name, created_at'
    )
    .eq('user_id', auth.userId)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (before) {
    query = query.lt('created_at', before)
  }

  const { data, error } = await query
  if (error) return { ok: false, error: error.message, httpHint: 500 }

  const logs = redactAgentLogRows((data ?? []) as Record<string, unknown>[])
  return {
    ok: true,
    data: {
      conversation_id: conversationId,
      count: logs.length,
      logs,
    },
  }
}

async function chytrKnowledgeQuery(
  auth: McpAuthContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const query = asString(args.query)
  if (!query) return { ok: false, error: 'query required', httpHint: 400 }

  const agentType = asString(args.agent_type) ?? null
  const matchCount = asLimit(args.match_count, 5, 20)
  const supabase = createSupabaseServiceClient()

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return { ok: false, error: 'Embedding service not configured', httpHint: 500 }
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/get-embedding`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ text: query }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[mcp/knowledge_query] get-embedding', err)
    return { ok: false, error: 'Embedding failed', httpHint: 502 }
  }

  const { embedding } = (await res.json()) as { embedding?: number[] }
  if (!embedding || !Array.isArray(embedding)) {
    return { ok: false, error: 'Invalid embedding response', httpHint: 502 }
  }

  const { data: results, error } = await supabase.rpc('match_knowledge', {
    query_embedding: embedding,
    match_threshold: 0.7,
    match_count: matchCount,
    p_agent_type: agentType,
    p_user_id: auth.userId,
  })

  if (error) return { ok: false, error: error.message, httpHint: 500 }

  const formatted = (results ?? []).map((r: { learning?: string }) => r.learning).join('\n\n')
  return { ok: true, data: { results: results ?? [], formatted } }
}

type McpToolName = keyof typeof MCP_TOOLS

export async function runMcpTool(
  name: string,
  auth: McpAuthContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  if (!(name in MCP_TOOLS)) return { ok: false, error: 'tool not found', httpHint: 404 }

  switch (name as McpToolName) {
    case 'chytr_logs_list':
      return chytrLogsList(auth, args)
    case 'chytr_knowledge_query':
      return chytrKnowledgeQuery(auth, args)
    default: {
      const _exhaustive: never = name as never
      return { ok: false, error: `unhandled tool: ${String(_exhaustive)}` }
    }
  }
}
