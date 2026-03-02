import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import { authenticateApiKey } from '@/lib/api-auth'
import { loadLicenseFromDB } from '@/lib/license-server'
import { isFeatureEnabled } from '@/lib/license'

export async function PATCH(req: NextRequest) {
  try {
    const auth = await authenticateApiKey(req)
    if (!auth) {
      return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
    }

    const body = (await req.json()) as {
      approval_id?: string
      decision?: string
      decided_by?: string
    }

    if (!body.approval_id) {
      return NextResponse.json({ error: 'approval_id required' }, { status: 400 })
    }
    if (!body.decision) {
      return NextResponse.json({ error: 'decision required' }, { status: 400 })
    }

    await loadLicenseFromDB()
    if (!isFeatureEnabled('approvals')) {
      return NextResponse.json(
        {
          error: 'feature_not_available',
          required_tier: 'pro',
          upgrade_url: 'https://www.chytr.ai/pricing',
        },
        { status: 403 }
      )
    }

    const supabase = createSupabaseServiceClient()

    const { data: approval, error: fetchError } = await supabase
      .from('approvals')
      .select('id, status, options')
      .eq('id', body.approval_id)
      .eq('user_id', auth.userId)
      .single()

    if (fetchError || !approval) {
      return NextResponse.json({ error: 'approval not found' }, { status: 404 })
    }

    if (approval.status !== 'pending') {
      return NextResponse.json(
        { error: 'approval already resolved', status: approval.status },
        { status: 409 }
      )
    }

    const options = approval.options as string[] | null
    if (options && options.length > 0 && !options.includes(body.decision)) {
      return NextResponse.json(
        { error: 'invalid decision', allowed: options },
        { status: 400 }
      )
    }

    const status =
      body.decision.toLowerCase() === 'approve' || body.decision.toLowerCase() === 'approved'
        ? 'approved'
        : 'rejected'

    const { error: updateError } = await supabase
      .from('approvals')
      .update({
        status,
        decision: body.decision,
        decided_by: body.decided_by ?? null,
        decided_at: new Date().toISOString(),
      })
      .eq('id', body.approval_id)
      .eq('user_id', auth.userId)

    if (updateError) {
      console.error('[v1/approvals/resolve]', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      approval_id: body.approval_id,
      decision: body.decision,
    })
  } catch (err) {
    console.error('[v1/approvals/resolve]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
