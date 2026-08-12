#!/usr/bin/env node
/**
 * Manifest ↔ handler drift test for MCP tools.
 * Fails if MCP_TOOLS keys and runMcpTool switch cases diverge.
 *
 * Run: node scripts/mcp-manifest-drift.test.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const toolsSrc = readFileSync(join(root, 'lib/mcp/tools.ts'), 'utf8')
const handlersSrc = readFileSync(join(root, 'lib/mcp/handlers.ts'), 'utf8')
const routeSrc = readFileSync(join(root, 'app/api/mcp/route.ts'), 'utf8')

const toolNames = [...toolsSrc.matchAll(/^\s{2}([a-z0-9_]+):\s*\{/gm)].map((m) => m[1])
assert.ok(toolNames.length >= 1, 'expected MCP_TOOLS entries')
assert.deepEqual(
  toolNames.sort(),
  ['chytr_knowledge_query', 'chytr_logs_list'].sort(),
  'MVP tools must be logs_list + knowledge_query only (chyt_* descoped)'
)

for (const name of toolNames) {
  assert.match(
    handlersSrc,
    new RegExp(`case '${name}':`),
    `handlers.ts missing case for ${name}`
  )
}

assert.match(routeSrc, /listMcpToolsForProtocol/, 'route must list tools from manifest')
assert.match(routeSrc, /runMcpTool/, 'route must dispatch via runMcpTool')
assert.match(handlersSrc, /redactAgentLogRows/, 'logs_list must redact before return')
assert.ok(
  !toolNames.some((n) => n.startsWith('chytr_chyt_')),
  'chyt tools must stay descoped'
)

console.log(`ok: ${toolNames.length} MCP tools in sync (${toolNames.join(', ')})`)
