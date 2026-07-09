import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import { authenticateApiKey } from '@/lib/api-auth'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateApiKey(req)
    if (!auth) {
      return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    let query = searchParams.get('query') ?? ''
    const agent_type = searchParams.get('agent_type')
    // Back-compat: accept the legacy `work_order_id` param name too.
    const chyt_id = searchParams.get('chyt_id') ?? searchParams.get('work_order_id')
    const match_count = Math.min(20, Math.max(1, parseInt(searchParams.get('match_count') ?? '5', 10)))

    if (!query && chyt_id) {
      const supabase = createSupabaseServiceClient()
      const { data: wo } = await supabase
        .from('chyts')
        .select('objective')
        .eq('id', chyt_id)
        .eq('user_id', auth.userId)
        .single()
      query = (wo?.objective as string) ?? ''
    }

    if (!query) {
      return NextResponse.json({ results: [], formatted: '' })
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/get-embedding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ text: query }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[v1/knowledge/query] get-embedding', err)
      return NextResponse.json({ error: 'Embedding failed' }, { status: 502 })
    }

    const { embedding } = (await res.json()) as { embedding?: number[] }
    if (!embedding || !Array.isArray(embedding)) {
      return NextResponse.json({ error: 'Invalid embedding response' }, { status: 502 })
    }

    const supabase = createSupabaseServiceClient()
    const { data: results, error } = await supabase.rpc('match_knowledge', {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count,
      p_agent_type: agent_type || null,
      p_user_id: auth.userId,
    })

    if (error) {
      console.error('[v1/knowledge/query] match_knowledge', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const formatted = (results ?? []).map((r: { learning?: string }) => r.learning).join('\n\n')
    return NextResponse.json({ results: results ?? [], formatted })
  } catch (err) {
    console.error('[v1/knowledge/query]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateApiKey(req)
    if (!auth) {
      return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
    }

    const body = (await req.json()) as {
      query?: string
      agent_type?: string
      chyt_id?: string
      /** @deprecated back-compat: legacy key name */
      work_order_id?: string
      match_count?: number
    }
    let query = body.query ?? ''
    const agent_type = body.agent_type ?? null
    const chyt_id = body.chyt_id ?? body.work_order_id
    const match_count = Math.min(
      20,
      Math.max(1, typeof body.match_count === 'number' ? body.match_count : 5)
    )

    if (!query && chyt_id) {
      const supabase = createSupabaseServiceClient()
      const { data: wo } = await supabase
        .from('chyts')
        .select('objective')
        .eq('id', chyt_id)
        .eq('user_id', auth.userId)
        .single()
      query = (wo?.objective as string) ?? ''
    }

    if (!query) {
      return NextResponse.json({ results: [], formatted: '' })
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/get-embedding`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ text: query }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[v1/knowledge/query] get-embedding', err)
      return NextResponse.json({ error: 'Embedding failed' }, { status: 502 })
    }

    const { embedding } = (await res.json()) as { embedding?: number[] }
    if (!embedding || !Array.isArray(embedding)) {
      return NextResponse.json({ error: 'Invalid embedding response' }, { status: 502 })
    }

    const supabase = createSupabaseServiceClient()
    const { data: results, error } = await supabase.rpc('match_knowledge', {
      query_embedding: embedding,
      match_threshold: 0.7,
      match_count,
      p_agent_type: agent_type,
      p_user_id: auth.userId,
    })

    if (error) {
      console.error('[v1/knowledge/query] match_knowledge', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const formatted = (results ?? []).map((r: { learning?: string }) => r.learning).join('\n\n')
    return NextResponse.json({ results: results ?? [], formatted })
  } catch (err) {
    console.error('[v1/knowledge/query]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
