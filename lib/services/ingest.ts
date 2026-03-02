import { createSupabaseServiceClient } from '@/lib/supabase'

export interface IngestEvent {
  event_type: string
  work_order_id?: string | null
  agent_id?: string | null
  raw_payload?: Record<string, unknown>
}

export interface IngestResult {
  ok: boolean
  followup_message?: string | null
  error?: string
}

export async function ingestLog(event: IngestEvent): Promise<IngestResult> {
  const { event_type, work_order_id, agent_id, raw_payload } = event

  if (!event_type) {
    return { ok: false, error: 'event_type required' }
  }

  const supabase = createSupabaseServiceClient()
  const payload = normalizePayload(event_type, raw_payload ?? {})

  const { error: insertError } = await supabase.from('agent_logs').insert({
    work_order_id: work_order_id ?? null,
    agent_id: agent_id ?? null,
    event_type,
    payload,
  })

  if (insertError) throw insertError

  if (agent_id) {
    await supabase
      .from('agents')
      .update({ last_heartbeat: new Date().toISOString(), status: 'active' })
      .eq('id', agent_id)
  }

  let followup_message: string | null = null
  if (event_type === 'session_end' && work_order_id) {
    followup_message = await checkDefinitionOfDone(supabase, work_order_id)

    const status = raw_payload?.status === 'failed' ? 'failed' : 'completed'
    await supabase
      .from('work_orders')
      .update({ status, finished_at: new Date().toISOString() })
      .eq('id', work_order_id)
  }

  return { ok: true, followup_message }
}

function normalizePayload(
  eventType: string,
  raw: Record<string, unknown>
): Record<string, unknown> {
  switch (eventType) {
    case 'tool_call':
    case 'tool_result':
      return {
        tool_name: raw.tool_name ?? raw.toolName ?? '',
        tool_id: raw.tool_id ?? raw.toolId ?? '',
        arguments: raw.arguments ?? raw.args ?? {},
        success: raw.success ?? true,
        duration_ms: raw.duration_ms ?? raw.durationMs ?? null,
        result_length:
          raw.result_length ?? (typeof raw.result === 'string' ? raw.result.length : null),
      }
    case 'tool_failure':
      return {
        tool_name: raw.tool_name ?? raw.toolName ?? '',
        error: raw.error ?? raw.message ?? 'Unknown error',
        arguments: raw.arguments ?? {},
      }
    case 'shell_execution':
      return {
        command: raw.command ?? raw.cmd ?? '',
        exit_code: raw.exit_code ?? raw.exitCode ?? 0,
        stdout_length:
          typeof raw.stdout === 'string' ? raw.stdout.length : (raw.stdout_length ?? 0),
        stderr_length:
          typeof raw.stderr === 'string' ? raw.stderr.length : (raw.stderr_length ?? 0),
        duration_ms: raw.duration_ms ?? null,
      }
    case 'file_edit':
      return {
        file_path: raw.file_path ?? raw.filePath ?? raw.path ?? '',
        lines_added: raw.lines_added ?? raw.linesAdded ?? 0,
        lines_removed: raw.lines_removed ?? raw.linesRemoved ?? 0,
        edit_type: raw.edit_type ?? raw.editType ?? 'edit',
      }
    case 'mcp_execution':
      return {
        server_name: raw.server_name ?? raw.serverName ?? '',
        tool_name: raw.tool_name ?? raw.toolName ?? '',
        arguments: raw.arguments ?? {},
        success: raw.success ?? true,
        duration_ms: raw.duration_ms ?? null,
      }
    case 'skill_load':
      return {
        skill_name: raw.skill_name ?? raw.skillName ?? '',
        repo_id: raw.repo_id ?? null,
        agent_id: raw.agent_id ?? null,
      }
    case 'agent_thought':
    case 'agent_response': {
      const content = String(raw.content ?? raw.message ?? '')
      return {
        content_length: content.length,
        content_preview: content.substring(0, 200),
      }
    }
    case 'subagent_start':
    case 'subagent_stop':
      return {
        subagent_id: raw.subagent_id ?? raw.subagentId ?? '',
        description: raw.description ?? '',
        result_summary: raw.result_summary ?? raw.resultSummary ?? '',
      }
    case 'approval_requested':
      return {
        approval_id: raw.approval_id ?? '',
        question: raw.question ?? '',
        options: raw.options ?? [],
        context_preview: String(raw.context ?? '').substring(0, 200),
      }
    case 'session_end':
      return {
        status: raw.status ?? 'completed',
        dod_result: raw.dod_result ?? null,
        lines_completed: raw.lines_completed ?? 0,
        lines_total: raw.lines_total ?? 0,
        duration_ms: raw.duration_ms ?? null,
      }
    default:
      return raw
  }
}

async function checkDefinitionOfDone(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  workOrderId: string
): Promise<string | null> {
  const { data: wo } = await supabase
    .from('work_orders')
    .select('lines')
    .eq('id', workOrderId)
    .single()

  if (!wo?.lines) return null

  const lines = wo.lines as Array<{
    id: string
    title: string
    status?: string
    definition_of_done?: string
  }>
  if (!Array.isArray(lines)) return null

  const incompleteLines = lines.filter((l) => !l.status || l.status === 'pending')
  if (incompleteLines.length === 0) return null

  const titles = incompleteLines.map((l) => `- ${l.title}`).join('\n')
  return `The following work order lines appear incomplete:\n${titles}\n\nPlease complete them before finishing.`
}
