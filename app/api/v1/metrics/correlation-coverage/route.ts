import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { authenticateApiKey } from '@/lib/api-auth'

/**
 * Correlation-key coverage metric (P1b).
 * GET /api/v1/metrics/correlation-coverage?hours=24
 * → { window_hours, total, with_conversation_id, with_cbmain, coverage_pct }
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateApiKey(req)
    if (!auth) {
      return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
    }

    const hoursRaw = req.nextUrl.searchParams.get('hours')
    const hours = Math.min(168, Math.max(1, parseInt(hoursRaw ?? '24', 10) || 24))
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase
      .from('agent_logs')
      .select('conversation_id, payload')
      .eq('user_id', auth.userId)
      .gte('created_at', since)

    if (error) {
      console.error('[metrics/correlation-coverage]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rows = data ?? []
    const total = rows.length
    let withConversationId = 0
    let withCbmain = 0
    for (const row of rows) {
      if (row.conversation_id) withConversationId += 1
      const payload = row.payload as Record<string, unknown> | null
      if (payload && typeof payload === 'object' && payload.cbmain) withCbmain += 1
    }

    const coveragePct =
      total === 0 ? null : Math.round((10000 * withConversationId) / total) / 100

    return NextResponse.json({
      window_hours: hours,
      total,
      with_conversation_id: withConversationId,
      with_cbmain: withCbmain,
      coverage_pct: coveragePct,
    })
  } catch (err) {
    console.error('[metrics/correlation-coverage]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
