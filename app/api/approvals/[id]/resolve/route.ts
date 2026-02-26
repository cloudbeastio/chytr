import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()
    const { decision, decided_by } = body

    if (!decision || typeof decision !== 'string') {
      return NextResponse.json({ error: 'decision is required' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()

    const status = decision === 'rejected' ? 'rejected' : 'approved'

    const { error } = await supabase
      .from('approvals')
      .update({
        status,
        decision,
        decided_by: decided_by ?? null,
        decided_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .eq('status', 'pending')

    if (error) {
      console.error('[approvals/resolve] supabase error', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[approvals/resolve] unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
