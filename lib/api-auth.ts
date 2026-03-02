import { createHash } from 'crypto'
import { NextRequest } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-service'

const PREFIX = 'chk_'

export interface ApiKeyAuth {
  userId: string
  keyId: string
}

export function hashApiKey(plain: string): string {
  return createHash('sha256').update(plain, 'utf8').digest('hex')
}

export function keyPrefix(plain: string): string {
  return plain.slice(0, 8)
}

/**
 * Validates Bearer token as API key. Returns userId and keyId or null.
 * Updates last_used_at on success.
 */
export async function authenticateApiKey(req: NextRequest): Promise<ApiKeyAuth | null> {
  try {
    const auth = req.headers.get('authorization')
    if (!auth?.toLowerCase().startsWith('bearer ')) return null
    const token = auth.slice(7).trim()
    if (!token.startsWith(PREFIX) || token.length < 12) return null

    const keyHash = hashApiKey(token)
    const supabase = createSupabaseServiceClient()

    const { data: row, error: fetchError } = await supabase
      .from('api_keys')
      .select('id, user_id')
      .eq('key_hash', keyHash)
      .is('revoked_at', null)
      .single()

    if (fetchError || !row) return null

    await supabase
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', row.id)

    return { userId: row.user_id, keyId: row.id }
  } catch {
    return null
  }
}

export function generateApiKeyValue(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return PREFIX + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
