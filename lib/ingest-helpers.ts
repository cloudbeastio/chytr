import type { SupabaseClient } from '@supabase/supabase-js'

/** Base schema fields sent with every Cursor hook event — preserve for analytics */
function baseSchema(raw: Record<string, unknown>): Record<string, unknown> {
  return {
    model: raw.model ?? null,
    conversation_id: raw.conversation_id ?? null,
    user_email: raw.user_email ?? null,
  }
}

function withBase(eventPayload: Record<string, unknown>, raw: Record<string, unknown>): Record<string, unknown> {
  return { ...eventPayload, ...baseSchema(raw) }
}

export function normalizePayload(
  eventType: string,
  raw: Record<string, unknown>
): Record<string, unknown> {
  const base = baseSchema(raw)
  switch (eventType) {
    case 'tool_call':
    case 'tool_result':
      return withBase(
        {
          tool_name: raw.tool_name ?? raw.toolName ?? '',
          tool_id: raw.tool_id ?? raw.toolId ?? '',
          arguments: raw.arguments ?? raw.args ?? {},
          success: raw.success ?? true,
          duration_ms: raw.duration_ms ?? raw.durationMs ?? raw.duration ?? null,
          result_length:
            raw.result_length ?? (typeof raw.result === 'string' ? raw.result.length : null),
        },
        raw
      )
    case 'tool_failure':
      return withBase(
        {
          tool_name: raw.tool_name ?? raw.toolName ?? '',
          error: raw.error_message ?? raw.error ?? raw.message ?? 'Unknown error',
          arguments: raw.arguments ?? {},
          failure_type: raw.failure_type ?? null,
          is_interrupt: raw.is_interrupt ?? null,
          duration_ms: raw.duration ?? raw.duration_ms ?? null,
        },
        raw
      )
    case 'shell_execution':
      return withBase(
        {
          command: raw.command ?? raw.cmd ?? '',
          exit_code: raw.exit_code ?? raw.exitCode ?? 0,
          stdout_length:
            typeof raw.stdout === 'string' ? raw.stdout.length : (raw.stdout_length ?? 0),
          stderr_length:
            typeof raw.stderr === 'string' ? raw.stderr.length : (raw.stderr_length ?? 0),
          duration_ms: raw.duration ?? raw.duration_ms ?? null,
        },
        raw
      )
    case 'file_edit': {
      const edits = Array.isArray(raw.edits) ? raw.edits : []
      let linesAdded = Number(raw.lines_added ?? raw.linesAdded ?? 0)
      let linesRemoved = Number(raw.lines_removed ?? raw.linesRemoved ?? 0)
      if (edits.length > 0) {
        for (const edit of edits as Array<{ old_string?: string; new_string?: string }>) {
          const oldStr = String(edit.old_string ?? '')
          const newStr = String(edit.new_string ?? '')
          linesAdded += (newStr.match(/\n/g) ?? []).length
          linesRemoved += (oldStr.match(/\n/g) ?? []).length
        }
      }
      return withBase(
        {
          file_path: raw.file_path ?? raw.filePath ?? raw.path ?? '',
          lines_added: linesAdded,
          lines_removed: linesRemoved,
          edit_type: raw.edit_type ?? raw.editType ?? 'edit',
        },
        raw
      )
    }
    case 'mcp_execution':
      return withBase(
        {
          server_name: raw.server_name ?? raw.serverName ?? '',
          tool_name: raw.tool_name ?? raw.toolName ?? '',
          arguments: raw.arguments ?? {},
          success: raw.success ?? true,
          duration_ms: raw.duration ?? raw.duration_ms ?? null,
        },
        raw
      )
    case 'skill_load':
      return withBase(
        {
          skill_name: raw.skill_name ?? raw.skillName ?? '',
          repo_id: raw.repo_id ?? null,
          agent_id: raw.agent_id ?? null,
        },
        raw
      )
    case 'agent_thought':
    case 'agent_response': {
      const content = String(raw.text ?? raw.content ?? raw.message ?? '')
      return withBase(
        {
          content_length: content.length,
          content_preview: content.substring(0, 200),
          duration_ms: raw.duration_ms ?? raw.duration ?? null,
        },
        raw
      )
    }
    case 'subagent_start':
      return withBase(
        {
          subagent_type: raw.subagent_type ?? '',
          prompt: raw.prompt ?? '',
        },
        raw
      )
    case 'subagent_stop':
      return withBase(
        {
          subagent_type: raw.subagent_type ?? '',
          status: raw.status ?? null,
          duration: raw.duration ?? null,
          result: raw.result ?? null,
          agent_transcript_path: raw.agent_transcript_path ?? null,
        },
        raw
      )
    case 'approval_requested':
      return withBase(
        {
          approval_id: raw.approval_id ?? '',
          question: raw.question ?? '',
          options: raw.options ?? [],
          context_preview: String(raw.context ?? '').substring(0, 200),
        },
        raw
      )
    case 'session_start':
      return withBase(
        {
          session_id: raw.session_id ?? null,
          composer_mode: raw.composer_mode ?? null,
          is_background_agent: raw.is_background_agent ?? null,
        },
        raw
      )
    case 'session_end':
      return withBase(
        {
          status: raw.status ?? 'completed',
          reason: raw.reason ?? null,
          error_message: raw.error_message ?? null,
          dod_result: raw.dod_result ?? null,
          lines_completed: raw.lines_completed ?? 0,
          lines_total: raw.lines_total ?? 0,
          duration_ms: raw.duration_ms ?? raw.duration ?? null,
          is_background_agent: raw.is_background_agent ?? null,
        },
        raw
      )
    case 'stop':
      return withBase(
        {
          status: raw.status ?? null,
          loop_count: raw.loop_count ?? null,
        },
        raw
      )
    case 'preCompact':
    case 'pre_compact':
      return withBase(
        {
          context_tokens: raw.context_tokens ?? raw.contextTokens ?? null,
          context_window_size: raw.context_window_size ?? raw.contextWindowSize ?? null,
          context_usage_percent: raw.context_usage_percent ?? raw.contextUsagePercent ?? null,
          trigger: raw.trigger ?? null,
          is_first_compaction: raw.is_first_compaction ?? raw.isFirstCompaction ?? null,
        },
        raw
      )
    default:
      return { ...raw, ...base }
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
