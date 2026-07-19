import { createHash } from 'crypto'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { loadLicenseFromDB } from '@/lib/license-server'
import { launchAgent } from '@/lib/services/launch-agent'
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

async function chytrChytCreate(
  auth: McpAuthContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const license = await loadLicenseFromDB()
  if (!license) {
    return { ok: false, error: 'No valid license', httpHint: 403 }
  }

  const objective = asString(args.objective)
  const lines = Array.isArray(args.lines) ? args.lines : undefined
  if (!objective && !lines) {
    return { ok: false, error: 'objective or lines required', httpHint: 400 }
  }

  const isDraft = args.status === 'draft'
  const status = isDraft ? 'draft' : 'pending'
  const supabase = createSupabaseServiceClient()

  const { data: workOrder, error: insertError } = await supabase
    .from('chyts')
    .insert({
      user_id: auth.userId,
      project_id: asString(args.project_id) ?? null,
      objective: objective ?? null,
      agent_id: asString(args.agent_id) ?? null,
      repo_id: asString(args.repo_id) ?? null,
      source: asString(args.source) ?? 'cloud',
      status,
      branch_name: asString(args.branch_name) ?? null,
      lines: lines ?? null,
      constraints: args.constraints ?? null,
      exploration_hints: args.exploration_hints ?? null,
      verification: args.verification ?? null,
      metadata: (args.metadata as Record<string, unknown>) ?? {},
    })
    .select()
    .single()

  if (insertError || !workOrder) {
    return { ok: false, error: insertError?.message ?? 'Failed to create chyt', httpHint: 500 }
  }

  let launchResult: Awaited<ReturnType<typeof launchAgent>> | null = null
  if (!isDraft && workOrder.source !== 'local') {
    launchResult = await launchAgent(workOrder.id)
  }

  return {
    ok: true,
    data: {
      ok: true,
      chyt_id: workOrder.id,
      status: isDraft
        ? 'draft'
        : workOrder.source === 'local'
          ? 'pending'
          : launchResult?.ok
            ? 'running'
            : 'pending',
      cursor_agent_id: launchResult?.cursor_agent_id ?? null,
      launch_error: launchResult?.ok ? null : (launchResult?.error ?? null),
    },
  }
}

async function chytrChytList(
  auth: McpAuthContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const supabase = createSupabaseServiceClient()
  const limit = asLimit(args.limit, 50, 200)

  let query = supabase
    .from('chyts')
    .select(
      '*, agents!agent_id(name), agent_repos!repo_id(repo_url), projects!project_id(id, name, type, status)'
    )
    .eq('user_id', auth.userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  const status = asString(args.status)
  const source = asString(args.source)
  const projectId = asString(args.project_id)
  if (status) query = query.eq('status', status)
  if (source) query = query.eq('source', source)
  if (projectId) query = query.eq('project_id', projectId)

  const { data, error } = await query
  if (error) return { ok: false, error: error.message, httpHint: 500 }
  return { ok: true, data: { chyts: data ?? [] } }
}

async function chytrChytGet(
  auth: McpAuthContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const chytId = asString(args.chyt_id)
  if (!chytId) return { ok: false, error: 'chyt_id required', httpHint: 400 }

  const supabase = createSupabaseServiceClient()
  const { data: owned, error: ownErr } = await supabase
    .from('chyts')
    .select('id')
    .eq('id', chytId)
    .eq('user_id', auth.userId)
    .maybeSingle()

  if (ownErr) return { ok: false, error: ownErr.message, httpHint: 500 }
  if (!owned) return { ok: false, error: 'Work order not found', httpHint: 404 }

  const { data, error } = await supabase.rpc('get_chyt', { p_chyt_id: chytId })
  if (error || !data) return { ok: false, error: 'Work order not found', httpHint: 404 }
  return { ok: true, data }
}

async function chytrLogsList(
  auth: McpAuthContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const chytId = asString(args.chyt_id)
  if (!chytId) return { ok: false, error: 'chyt_id required', httpHint: 400 }

  const supabase = createSupabaseServiceClient()
  const { data: owned, error: ownErr } = await supabase
    .from('chyts')
    .select('id')
    .eq('id', chytId)
    .eq('user_id', auth.userId)
    .maybeSingle()

  if (ownErr) return { ok: false, error: ownErr.message, httpHint: 500 }
  if (!owned) return { ok: false, error: 'Work order not found', httpHint: 404 }

  const limit = asLimit(args.limit, 100, 500)
  const { data, error } = await supabase
    .from('agent_logs')
    .select('id, chyt_id, agent_id, event_type, payload, sequence_number, model, conversation_id, created_at')
    .eq('chyt_id', chytId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) return { ok: false, error: error.message, httpHint: 500 }
  return { ok: true, data: { logs: data ?? [] } }
}

async function chytrKnowledgeQuery(
  auth: McpAuthContext,
  args: Record<string, unknown>
): Promise<ToolResult> {
  let query = asString(args.query) ?? ''
  const agentType = asString(args.agent_type) ?? null
  const chytId = asString(args.chyt_id)
  const matchCount = asLimit(args.match_count, 5, 20)

  const supabase = createSupabaseServiceClient()

  if (!query && chytId) {
    const { data: wo } = await supabase
      .from('chyts')
      .select('objective')
      .eq('id', chytId)
      .eq('user_id', auth.userId)
      .maybeSingle()
    query = (wo?.objective as string) ?? ''
  }

  if (!query) return { ok: true, data: { results: [], formatted: '' } }

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
    case 'chytr_chyt_create':
      return chytrChytCreate(auth, args)
    case 'chytr_chyt_list':
      return chytrChytList(auth, args)
    case 'chytr_chyt_get':
      return chytrChytGet(auth, args)
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
