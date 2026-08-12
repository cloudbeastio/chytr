import type { McpAccess } from './scopes'

export interface McpToolDef {
  name: string
  description: string
  access: McpAccess
  /** Reserved for v1.1 named scopes; MVP = empty (owner-scope). */
  required_scopes: string[]
  inputSchema: Record<string, unknown>
}

/**
 * MCP tool manifest — keep in sync with handlers in lib/mcp/handlers.ts
 * and dispatch in app/api/mcp/route.ts (drift test: scripts/mcp-manifest-drift.test.mjs).
 *
 * chytr_chyt_* descoped: chyts table is empty; telemetry is log-centric (D5).
 */
export const MCP_TOOLS: Record<string, McpToolDef> = {
  chytr_logs_list: {
    name: 'chytr_logs_list',
    description:
      'List agent_logs for a runtime run id (conversation_id). Join key = ops.work_items.chyt_id (runtime run id). Credentials redacted.',
    access: 'read',
    required_scopes: [],
    inputSchema: {
      type: 'object',
      properties: {
        conversation_id: {
          type: 'string',
          description: 'Runtime run id (bc-… / session_…). Alias: runtime_run_id.',
        },
        runtime_run_id: {
          type: 'string',
          description: 'Alias for conversation_id',
        },
        limit: { type: 'integer', minimum: 1, maximum: 500, default: 100 },
        before: { type: 'string', description: 'ISO timestamp cursor (exclusive upper bound)' },
      },
      anyOf: [{ required: ['conversation_id'] }, { required: ['runtime_run_id'] }],
    },
  },
  chytr_knowledge_query: {
    name: 'chytr_knowledge_query',
    description: 'Vector query over the knowledge loop (match_knowledge). Owner-scoped.',
    access: 'read',
    required_scopes: [],
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search text' },
        agent_type: { type: 'string' },
        match_count: { type: 'integer', minimum: 1, maximum: 20, default: 5 },
      },
      required: ['query'],
    },
  },
}

export const MCP_TOOL_NAMES = Object.keys(MCP_TOOLS)

export function listMcpToolsForProtocol(): Array<{
  name: string
  description: string
  inputSchema: Record<string, unknown>
}> {
  return MCP_TOOL_NAMES.map((name) => {
    const t = MCP_TOOLS[name]
    return {
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }
  })
}
