#!/usr/bin/env node
/**
 * Unit checks for correlation contract + redaction (no network).
 * Run: node scripts/cbmain-contract.test.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

// Load TS helpers via dynamic transpile is heavy — assert source contracts instead +
// light runtime via node --experimental-strip-types when available.
const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const contract = readFileSync(join(root, 'lib/cbmain-contract.ts'), 'utf8')
assert.match(contract, /runtime_run_id/)
assert.match(contract, /resolveConversationId/)
assert.match(contract, /resolveCbmain/)
assert.match(contract, /session_id/)

const redact = readFileSync(join(root, 'lib/mcp/redact.ts'), 'utf8')
assert.match(redact, /ghs_/)
assert.match(redact, /redactAgentLogRow/)
assert.match(redact, /source_repo/)

const ingest = readFileSync(join(root, 'app/api/v1/ingest/route.ts'), 'utf8')
assert.match(ingest, /resolveConversationId/)
assert.match(ingest, /resolveCbmain/)
assert.match(ingest, /cbmain_stamped/)

console.log('ok: contract + redact + ingest wiring present')

// Prefer runtime strip-types if Node supports it
const major = Number(process.versions.node.split('.')[0])
if (major >= 22) {
  const { pathToFileURL } = await import('node:url')
  const { resolveConversationId, resolveCbmain } = await import(
    pathToFileURL(join(root, 'lib/cbmain-contract.ts')).href
  )
  const { redactAgentLogRow, scrubCredentials } = await import(
    pathToFileURL(join(root, 'lib/mcp/redact.ts')).href
  )

  assert.equal(
    resolveConversationId({
      rawPayload: { conversation_id: 'bc-abc' },
    }),
    'bc-abc'
  )
  assert.equal(
    resolveConversationId({
      rawPayload: { session_id: 'session_xyz' },
      envRuntimeRunId: null,
    }),
    'session_xyz'
  )
  assert.equal(
    resolveConversationId({
      bodyRuntimeRunId: 'bc-top',
      rawPayload: { conversation_id: 'bc-raw' },
    }),
    'bc-top'
  )

  const cb = resolveCbmain({
    conversationId: 'bc-1',
    bodyCbmain: { work_item_short_id: 'W1', task_short_id: 'T1' },
  })
  assert.equal(cb?.runtime_run_id, 'bc-1')
  assert.equal(cb?.work_item_short_id, 'W1')

  assert.match(scrubCredentials('token ghs_ABCDEFGHIJKLMNOPQRSTUVWX rest'), /REDACTED/)
  const row = redactAgentLogRow({
    source_repo: 'https://x-access-token:ghs_ABCDEFGHIJKLMNOPQRSTUVWX@github.com/o/r.git',
    payload: { note: 'Bearer eyJhbGciOiJIUzI1NiJ9.aaaa.bbbb' },
  })
  assert.doesNotMatch(String(row.source_repo), /ghs_/)
  assert.match(JSON.stringify(row.payload), /REDACTED/)

  console.log('ok: runtime contract + redact assertions')
} else {
  console.log('skip runtime (need node>=22 strip-types)')
}
