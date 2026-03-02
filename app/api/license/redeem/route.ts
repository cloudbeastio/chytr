import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import { hashLicenseKey, isLicenseKeyFormat } from '@/lib/license-key-auth'
import { generateLicenseJWT } from '@/lib/license-issuer'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { key?: string; instance_id?: string }
    const key = typeof body.key === 'string' ? body.key.trim() : ''
    const instance_id = typeof body.instance_id === 'string' ? body.instance_id.trim() || undefined : undefined

    if (!isLicenseKeyFormat(key)) {
      return NextResponse.json(
        { error: 'Invalid license key format' },
        { status: 400 }
      )
    }

    const keyHash = hashLicenseKey(key)
    const service = createSupabaseServiceClient()

    const { data: row, error: fetchError } = await service
      .from('license_keys')
      .select('id, user_id, tier, activated_instance_id')
      .eq('key_hash', keyHash)
      .is('revoked_at', null)
      .single()

    if (fetchError || !row) {
      return NextResponse.json({ error: 'Invalid or revoked license key' }, { status: 400 })
    }

    const activatedInstanceId = row.activated_instance_id as string | null
    if (activatedInstanceId != null && instance_id != null && activatedInstanceId !== instance_id) {
      return NextResponse.json(
        { error: 'Key already in use on another instance' },
        { status: 409 }
      )
    }

    if (activatedInstanceId == null && instance_id != null) {
      await service
        .from('license_keys')
        .update({ activated_instance_id: instance_id })
        .eq('id', row.id)
    }

    const { data: { user }, error: userError } = await service.auth.admin.getUserById(row.user_id)
    if (userError || !user?.email) {
      console.error('[license/redeem] getUserById', userError)
      return NextResponse.json({ error: 'Failed to resolve license' }, { status: 500 })
    }

    const tier = (row.tier as 'free' | 'pro' | 'team') || 'free'
    const license_key = await generateLicenseJWT(user.email, tier)

    return NextResponse.json({ license_key })
  } catch (err) {
    console.error('[license/redeem]', err)
    return NextResponse.json({ error: 'Failed to redeem license key' }, { status: 500 })
  }
}
