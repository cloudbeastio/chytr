import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/api-auth'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const EDGE_FN_TIMEOUT_MS = 10_000

export async function GET(req: NextRequest) {
  const auth = await validateApiKey(req)
  if (!auth.valid) return auth.response!

  try {
    const url = new URL(req.url)
    const query = url.searchParams.get('query') ?? ''
    const workOrderId = url.searchParams.get('work_order_id') ?? ''
    const agentType = url.searchParams.get('agent_type') ?? ''

    const params = new URLSearchParams()
    if (query) params.set('query', query)
    if (workOrderId) params.set('work_order_id', workOrderId)
    if (agentType) params.set('agent_type', agentType)

    const edgeUrl = `${SUPABASE_URL}/functions/v1/query-knowledge?${params.toString()}`

    const res = await fetch(edgeUrl, {
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(EDGE_FN_TIMEOUT_MS),
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    console.error('[knowledge/GET] error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await validateApiKey(req)
  if (!auth.valid) return auth.response!

  try {
    const body = await req.json()

    const edgeUrl = `${SUPABASE_URL}/functions/v1/embed`

    const res = await fetch(edgeUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(EDGE_FN_TIMEOUT_MS),
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    console.error('[knowledge/POST] error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
