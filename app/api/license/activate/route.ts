import { NextRequest, NextResponse } from 'next/server'
import { validateAndStoreLicense } from '@/lib/license'

export async function POST(req: NextRequest) {
  try {
    const { key } = await req.json()
    if (!key || typeof key !== 'string') {
      return NextResponse.json({ error: 'License key required' }, { status: 400 })
    }

    const result = await validateAndStoreLicense(key.trim())
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ ok: true, tier: result.license?.tier })
  } catch {
    return NextResponse.json({ error: 'Failed to activate license' }, { status: 500 })
  }
}
