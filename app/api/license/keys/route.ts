import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase-server'
import {
  hashLicenseKey,
  licenseKeyPrefix,
  generateLicenseKeyValue,
} from '@/lib/license-key-auth'

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
      .from('license_keys')
      .select('id, key_prefix, name, tier, created_at, revoked_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[license/keys GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      keys: (rows ?? []).map((k) => ({
        id: k.id,
        key_prefix: k.key_prefix,
        name: k.name,
        tier: k.tier,
        created_at: k.created_at,
        revoked: !!k.revoked_at,
      })),
    })
  } catch (err) {
    console.error('[license/keys GET]', err)
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

    const service = createSupabaseServiceClient()
    const { data: tierRow } = await service
      .from('instance_config')
      .select('value')
      .eq('key', 'stripe_tier')
      .single()
    const tier = (tierRow?.value as 'free' | 'pro' | 'team') || 'free'

    const plainKey = generateLicenseKeyValue()
    const key_hash = hashLicenseKey(plainKey)
    const key_prefix = licenseKeyPrefix(plainKey)

    const { data: row, error } = await service
      .from('license_keys')
      .insert({
        user_id: user.id,
        key_hash,
        key_prefix,
        name,
        tier,
      })
      .select('id, key_prefix, name, tier, created_at')
      .single()

    if (error) {
      console.error('[license/keys POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      id: row.id,
      key_prefix: row.key_prefix,
      name: row.name,
      tier: row.tier,
      created_at: row.created_at,
      license_key: plainKey,
    })
  } catch (err) {
    console.error('[license/keys POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
