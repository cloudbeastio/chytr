import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import { validateAndStoreLicense } from '@/lib/license-server'

const LICENSE_REDEEM_URL = 'https://chytr.ai/api/license/redeem'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { key?: string }
    const key = typeof body.key === 'string' ? body.key.trim() : ''
    if (!key) {
      return NextResponse.json({ error: 'License key required' }, { status: 400 })
    }

    if (key.startsWith('chl_')) {
      const service = createSupabaseServiceClient()
      const { data: instanceRow } = await service
        .from('instance_config')
        .select('value')
        .eq('key', 'instance_id')
        .single()
      const instance_id = instanceRow?.value ?? undefined

      const redeemRes = await fetch(LICENSE_REDEEM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, instance_id }),
      })

      if (redeemRes.status === 409) {
        return NextResponse.json(
          { error: 'Key already in use on another instance' },
          { status: 400 }
        )
      }

      if (!redeemRes.ok) {
        const data = await redeemRes.json().catch(() => ({})) as { error?: string }
        return NextResponse.json(
          { error: data.error ?? 'Invalid license key' },
          { status: 400 }
        )
      }

      const { license_key } = (await redeemRes.json()) as { license_key?: string }
      if (!license_key) {
        return NextResponse.json({ error: 'Invalid license key' }, { status: 400 })
      }

      const result = await validateAndStoreLicense(license_key)
      if (!result.valid) {
        return NextResponse.json({ error: result.error ?? 'Invalid license key' }, { status: 400 })
      }
      return NextResponse.json({ ok: true, tier: result.license?.tier })
    }

    const result = await validateAndStoreLicense(key)
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({ ok: true, tier: result.license?.tier })
  } catch (err) {
    console.error('[license/activate]', err)
    return NextResponse.json({ error: 'Failed to activate license' }, { status: 500 })
  }
}
