import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/api-auth'
import { createApproval } from '@/lib/services/approvals'

export async function POST(req: NextRequest) {
  const auth = await validateApiKey(req)
  if (!auth.valid) return auth.response!

  try {
    const body = await req.json()
    const result = await createApproval(body)

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, ...(result.required_tier ? { required_tier: result.required_tier } : {}) },
        { status: result.status ?? 500 }
      )
    }

    return NextResponse.json({ ok: true, approval_id: result.approval_id }, { status: 201 })
  } catch (err) {
    console.error('[approvals/POST] unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
