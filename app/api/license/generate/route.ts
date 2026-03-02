import { decodeJwt } from 'jose'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase-server'
import { generateLicenseJWT } from '@/lib/license-issuer'

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const email = user.email ?? ''
    const service = createSupabaseServiceClient()
    const { data: tierRow } = await service
      .from('instance_config')
      .select('value')
      .eq('key', 'stripe_tier')
      .single()
    const tier = (tierRow?.value as 'free' | 'pro' | 'team') || 'free'
    const license_key = await generateLicenseJWT(email, tier)
    const decoded = decodeJwt(license_key) as Record<string, unknown>
    const license_decoded = JSON.stringify(decoded)
    const now = new Date().toISOString()
    await service.from('instance_config').upsert(
      [
        { key: 'license_key', value: license_key },
        { key: 'license_decoded', value: license_decoded },
        { key: 'activated_at', value: now },
      ],
      { onConflict: 'key' }
    )
    return NextResponse.json({ license_key, tier })
  } catch (err) {
    console.error('[license/generate]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Generate failed' },
      { status: 500 }
    )
  }
}
