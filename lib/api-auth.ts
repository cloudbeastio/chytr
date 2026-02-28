import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from './supabase'

const CHYTR_API_KEY = process.env.CHYTR_API_KEY ?? ''

let cachedDbKey = ''
let cacheTs = 0
const CACHE_TTL_MS = 60_000

async function getApiKey(): Promise<string> {
  if (CHYTR_API_KEY) return CHYTR_API_KEY

  if (cachedDbKey && Date.now() - cacheTs < CACHE_TTL_MS) return cachedDbKey as string

  try {
    const supabase = createSupabaseServiceClient()
    const { data } = await supabase
      .from('instance_config')
      .select('value')
      .eq('key', 'api_key')
      .single()
    if (data?.value) {
      cachedDbKey = data.value
      cacheTs = Date.now()
      return cachedDbKey
    }
  } catch {
    // DB not ready
  }
  return ''
}

function extractKey(req: NextRequest): string | null {
  const auth = req.headers.get('authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return req.headers.get('x-api-key')
}

export async function validateApiKey(
  req: NextRequest
): Promise<{ valid: boolean; response?: NextResponse }> {
  const provided = extractKey(req)
  if (!provided) {
    return {
      valid: false,
      response: NextResponse.json({ error: 'Missing API key' }, { status: 401 }),
    }
  }

  const expected = await getApiKey()
  if (!expected) {
    return {
      valid: false,
      response: NextResponse.json(
        { error: 'API key not configured on this instance' },
        { status: 503 }
      ),
    }
  }

  if (provided !== expected) {
    return {
      valid: false,
      response: NextResponse.json({ error: 'Invalid API key' }, { status: 401 }),
    }
  }

  return { valid: true }
}

export function getWebhookSecret(): string {
  return CHYTR_API_KEY
}
