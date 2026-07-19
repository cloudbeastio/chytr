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
 * MCP tool manifest. Keep in sync with handlers in lib/mcp/handlers.ts
 * and dispatch in app/api/mcp/route.ts.
 */
export const MCP_TOOLS: Record<string, McpToolDef> = {
  chytr_chyt_create: {
    name: 'chytr_chyt_create',
    description:
      'Create a chyt (work order). Launches a Cursor agent unless source=local or status=draft. Requires chk_ PAT + live license.',
    access: 'write',
    required_scopes: [],
    inputSchema: {
      type: 'object',
      properties: {
        objective: { type: 'string', description: 'Work objective' },
        lines: { type: 'array', items: { type: 'string' }, description: 'Work lines (alt to objective)' },
        agent_id: { type: 'string', description: 'Agent UUID' },
        repo_id: { type: 'string', description: 'Repo UUID' },
        project_id: { type: 'string', description: 'Project UUID' },
        constraints: { type: 'array', items: { type: 'string' } },
        exploration_hints: { type: 'array', items: { type: 'string' } },
        verification: { type: 'array', items: { type: 'string' } },
        branch_name: { type: 'string' },
        source: { type: 'string', enum: ['cloud', 'local'], description: 'Default cloud' },
        status: { type: 'string', enum: ['draft', 'pending'], description: 'draft skips launch' },
        metadata: { type: 'object' },
      },
    },
  },
  chytr_chyt_list: {
    name: 'chytr_chyt_list',
    description: 'List chyts for the authenticated owner. Optional filters: status, source, project_id, limit.',
    access: 'read',
    required_scopes: [],
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string' },
        source: { type: 'string' },
        project_id: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
      },
    },
  },
  chytr_chyt_get: {
    name: 'chytr_chyt_get',
    description: 'Get one chyt by id (owner-scoped) with status/timestamps/launch fields.',
    access: 'read',
    required_scopes: [],
    inputSchema: {
      type: 'object',
      properties: {
        chyt_id: { type: 'string', description: 'Chyt UUID' },
      },
      required: ['chyt_id'],
    },
  },
  chytr_logs_list: {
    name: 'chytr_logs_list',
    description: 'List agent_logs for a chyt (session timeline). Owner-scoped via chyt ownership.',
    access: 'read',
    required_scopes: [],
    inputSchema: {
      type: 'object',
      properties: {
        chyt_id: { type: 'string', description: 'Chyt UUID' },
        limit: { type: 'integer', minimum: 1, maximum: 500, default: 100 },
      },
      required: ['chyt_id'],
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
        query: { type: 'string', description: 'Search text (or omit if chyt_id set to use objective)' },
        agent_type: { type: 'string' },
        chyt_id: { type: 'string' },
        match_count: { type: 'integer', minimum: 1, maximum: 20, default: 5 },
      },
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
