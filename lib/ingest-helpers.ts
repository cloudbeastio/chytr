import type { SupabaseClient } from '@supabase/supabase-js'

export function normalizePayload(
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

export async function checkDefinitionOfDone(
  supabase: SupabaseClient,
  workOrderId: string,
  _payload: Record<string, unknown>
): Promise<string | null> {
  const { data: wo } = await supabase
    .from('work_orders')
    .select('lines, verification, objective')
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
