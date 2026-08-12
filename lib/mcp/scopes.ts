/**
 * MCP credential-type gate (MVP).
 *
 * Coarse owner-scope: every valid key/JWT is full-owner for allowed tools.
 * Read/write split is by credential type, not named per-tool scopes (v1.1).
 *   - PAT (chk_)  → read + write
 *   - OAuth JWT   → read only
 */

export type McpAuthKind = 'pat' | 'oauth'

export type McpAccess = 'read' | 'write'

export interface McpAuthContext {
  kind: McpAuthKind
  userId: string
  /** Present when kind=pat */
  keyId?: string
}

/** True when this credential may call a tool with the given access level. */
export function canAccess(auth: McpAuthContext, access: McpAccess): boolean {
  if (access === 'read') return true
  return auth.kind === 'pat'
}

export function accessDeniedMessage(access: McpAccess): string {
  if (access === 'write') {
    return 'Write tools require a chk_ API key (PAT); OAuth JWT is read-only'
  }
  return 'Insufficient access'
}
