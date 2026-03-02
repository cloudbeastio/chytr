import { decodeJwt } from 'jose'
import { NextRequest, NextResponse } from 'next/server'
import { validateLicenseJWT } from '@/lib/license'
import { generateLicenseJWT } from '@/lib/license-issuer'

const GRACE_MS = 7 * 24 * 60 * 60 * 1000

export async function POST(req: NextRequest) {
  try {
    let body: { license_key?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }
    const license_key = body?.license_key
    if (!license_key || typeof license_key !== 'string') {
      return NextResponse.json({ error: 'license_key required' }, { status: 400 })
    }

    const result = await validateLicenseJWT(license_key)
    if (result.valid && result.license) {
      const newJwt = await generateLicenseJWT(result.license.email, result.license.tier)
      return NextResponse.json({ license_key: newJwt, tier: result.license.tier })
    }

    try {
      const payload = decodeJwt(license_key) as { email?: string; tier?: 'free' | 'pro' | 'team'; exp?: number }
      const exp = payload.exp
      if (exp == null) {
        return NextResponse.json({ error: 'License expired' }, { status: 403 })
      }
      if (exp * 1000 + GRACE_MS <= Date.now()) {
        return NextResponse.json({ error: 'License expired' }, { status: 403 })
      }
      const email = payload.email ?? ''
      const tier = payload.tier ?? 'free'
      const newJwt = await generateLicenseJWT(email, tier)
      return NextResponse.json({ license_key: newJwt, tier })
    } catch {
      return NextResponse.json({ error: 'License expired' }, { status: 403 })
    }
  } catch (err) {
    console.error('[license/refresh]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Refresh failed' },
      { status: 500 }
    )
  }
}
