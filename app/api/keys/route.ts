import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase-server'
import { hashApiKey, keyPrefix, generateApiKeyValue } from '@/lib/api-auth'

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const service = createSupabaseServiceClient()
    const { data: rows, error } = await service
      .from('api_keys')
      .select('id, key_prefix, name, last_used_at, created_at, revoked_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[keys GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      keys: (rows ?? []).map((k) => ({
        id: k.id,
        key_prefix: k.key_prefix,
        name: k.name,
        last_used_at: k.last_used_at,
        created_at: k.created_at,
        revoked: !!k.revoked_at,
      })),
    })
  } catch (err) {
    console.error('[keys GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await req.json()) as { name?: string }
    const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : 'Default'

    const plainKey = generateApiKeyValue()
    const key_hash = hashApiKey(plainKey)
    const key_prefix = keyPrefix(plainKey)

    const service = createSupabaseServiceClient()
    const { data: row, error } = await service
      .from('api_keys')
      .insert({
        user_id: user.id,
        key_hash,
        key_prefix,
        name,
      })
      .select('id, key_prefix, name, created_at')
      .single()

    if (error) {
      console.error('[keys POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      id: row.id,
      key_prefix: row.key_prefix,
      name: row.name,
      created_at: row.created_at,
      api_key: plainKey,
    })
  } catch (err) {
    console.error('[keys POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
