import { NextRequest, NextResponse } from 'next/server'
import { authenticateMcpRequest, mcpResourceUrl } from '@/lib/mcp/auth'
import { accessDeniedMessage, canAccess } from '@/lib/mcp/scopes'
import { listMcpToolsForProtocol, MCP_TOOLS } from '@/lib/mcp/tools'
import { hashArgs, runMcpTool, writeMcpAudit } from '@/lib/mcp/handlers'

export const runtime = 'nodejs'

const SERVER_NAME = 'chytr'
const SERVER_VERSION = process.env.npm_package_version ?? '0.1.0'
const PROTOCOL_VERSION = '2024-11-05'

function jsonRpc(
  body: Record<string, unknown>,
  init?: { status?: number; headers?: Record<string, string> }
): NextResponse {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
}

function unauthorized(req: NextRequest, id: unknown): NextResponse {
  const www = `Bearer resource_metadata="${mcpResourceUrl(req)}"`
  return jsonRpc(
    {
      jsonrpc: '2.0',
      error: { code: -32001, message: 'Unauthorized' },
      id: id ?? null,
    },
    {
      status: 401,
      headers: { 'WWW-Authenticate': www },
    }
  )
}

/** GET discovery probe → 401 + WWW-Authenticate (RFC 9728). */
export async function GET(req: NextRequest) {
  return unauthorized(req, null)
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown> = {}
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    body = {}
  }

  const id = body.id ?? null
  const method = String(body.method ?? '')

  const auth = await authenticateMcpRequest(req)
  if (!auth) {
    return unauthorized(req, id)
  }

  try {
    if (body.jsonrpc !== '2.0') {
      return jsonRpc({
        jsonrpc: '2.0',
        id,
        error: { code: -32600, message: 'invalid jsonrpc' },
      })
    }

    if (method === 'initialize') {
      return jsonRpc({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        },
      })
    }

    if (method.startsWith('notifications/')) {
      return new NextResponse(null, { status: 204 })
    }

    if (method === 'tools/list') {
      return jsonRpc({
        jsonrpc: '2.0',
        id,
        result: { tools: listMcpToolsForProtocol() },
      })
    }

    if (method === 'tools/call') {
      const params = (body.params as Record<string, unknown>) ?? {}
      const name = String(params.name ?? '')
      const args = (params.arguments as Record<string, unknown>) ?? {}
      const started = Date.now()
      const argsHash = hashArgs(args)
      const def = MCP_TOOLS[name]

      if (!def) {
        await writeMcpAudit({
          auth,
          tool: name,
          argsHash,
          status: 'error',
          durationMs: Date.now() - started,
          error: 'unknown_tool',
        })
        return jsonRpc({
          jsonrpc: '2.0',
          id,
          error: { code: -32601, message: 'tool not found' },
        })
      }

      if (!canAccess(auth, def.access)) {
        const msg = accessDeniedMessage(def.access)
        await writeMcpAudit({
          auth,
          tool: name,
          argsHash,
          status: 'error',
          durationMs: Date.now() - started,
          error: msg,
        })
        return jsonRpc({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify({ error: msg }) }],
            isError: true,
          },
        })
      }

      const result = await runMcpTool(name, auth, args)
      const durationMs = Date.now() - started

      if (!result.ok) {
        await writeMcpAudit({
          auth,
          tool: name,
          argsHash,
          status: 'error',
          durationMs,
          error: result.error,
        })
        return jsonRpc({
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify({ error: result.error }) }],
            isError: true,
          },
        })
      }

      await writeMcpAudit({
        auth,
        tool: name,
        argsHash,
        status: 'ok',
        durationMs,
      })

      return jsonRpc({
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(result.data) }],
        },
      })
    }

    return jsonRpc({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `method not found: ${method}` },
    })
  } catch (err) {
    console.error('[api/mcp]', err)
    return jsonRpc({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: err instanceof Error ? err.message : 'Internal error',
      },
    })
  }
}
