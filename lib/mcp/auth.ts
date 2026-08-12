import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { authenticateApiKey } from '@/lib/api-auth'
import type { McpAuthContext } from './scopes'

const PREFIX = 'chk_'

function bearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  if (!auth?.toLowerCase().startsWith('bearer ')) return null
  const token = auth.slice(7).trim()
  return token.length > 0 ? token : null
}

/**
 * Resolve MCP caller: chk_ PAT via api_keys, else GoTrue JWT (read-only path).
 * Returns null when missing/invalid.
 */
export async function authenticateMcpRequest(req: NextRequest): Promise<McpAuthContext | null> {
  const token = bearerToken(req)
  if (!token) return null

  if (token.startsWith(PREFIX)) {
    const pat = await authenticateApiKey(req)
    if (!pat) return null
    return { kind: 'pat', userId: pat.userId, keyId: pat.keyId }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return null

  try {
    const supabase = createClient(url, anon, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user?.id) return null
    return { kind: 'oauth', userId: data.user.id }
  } catch {
    return null
  }
}

export function mcpResourceUrl(req: NextRequest): string {
  const fromEnv = process.env.CHYTR_PUBLIC_URL?.replace(/\/$/, '').trim()
  if (fromEnv) return `${fromEnv}/api/mcp`
  const proto = (req.headers.get('x-forwarded-proto') ?? 'https').split(',')[0]?.trim() || 'https'
  const host = (req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? '')
    .split(',')[0]
    ?.trim()
  if (host) return `${proto}://${host}/api/mcp`
  return new URL('/api/mcp', req.url).toString()
}

/** Authorization server origin for RFC 9728 (env override for D3 Cursor/Claude quirks). */
export function mcpAuthorizationServer(): string {
  const override = process.env.CHYTR_MCP_AUTH_SERVER?.replace(/\/$/, '').trim()
  if (override) return override
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '').trim()
  if (supabase) return `${supabase}/auth/v1`
  return 'https://invalid.local/auth/v1'
}
