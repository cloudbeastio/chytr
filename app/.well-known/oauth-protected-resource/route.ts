import { NextRequest, NextResponse } from 'next/server'
import { mcpAuthorizationServer, mcpResourceUrl } from '@/lib/mcp/auth'

export const runtime = 'nodejs'

/** RFC 9728 OAuth protected resource metadata for /api/mcp. */
export async function GET(req: NextRequest) {
  const resource = mcpResourceUrl(req)
  const authorizationServer = mcpAuthorizationServer()

  return NextResponse.json(
    {
      resource,
      authorization_servers: [authorizationServer],
      scopes_supported: ['openid', 'profile', 'email'],
      bearer_methods_supported: ['header'],
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=3600',
        'Content-Type': 'application/json',
      },
    }
  )
}
