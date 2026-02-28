import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/api-auth'
import { resolveApproval } from '@/lib/services/approvals'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(req)
  if (!auth.valid) return auth.response!

  try {
    const { id } = await params
    const body = await req.json()
    const { decision, decided_by } = body

    const result = await resolveApproval(id, decision, decided_by)

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, ...(result.allowed ? { allowed: result.allowed } : {}) },
        { status: result.status ?? 500 }
      )
    }

    return NextResponse.json({ ok: true, approval_id: id, decision: result.decision })
  } catch (err) {
    console.error('[approvals/resolve/POST] unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
