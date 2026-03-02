import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/api-auth'
import { createSupabaseServiceClient } from '@/lib/supabase'
import type { Json } from '@/lib/database.types'

export async function GET(req: NextRequest) {
  const auth = await validateApiKey(req)
  if (!auth.valid) return auth.response!

  try {
    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ agents: data })
  } catch (err) {
    console.error('[v1/agents/GET] error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await validateApiKey(req)
  if (!auth.valid) return auth.response!

  try {
    const body = await req.json()

    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase
      .from('agents')
      .insert({
        name: body.name.trim(),
        description: body.description ?? null,
        system_prompt: body.system_prompt ?? null,
        type: body.type ?? 'cursor',
        notification_config: (body.notification_config ?? {}) as Json,
        status: 'offline',
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('[v1/agents/POST] error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
