import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/api-auth'
import { createSupabaseServiceClient } from '@/lib/supabase'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await validateApiKey(req)
  if (!auth.valid) return auth.response!

  try {
    const { id } = await params
    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[v1/agents/GET/:id] error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await validateApiKey(req)
  if (!auth.valid) return auth.response!

  try {
    const { id } = await params
    const body = await req.json()

    const update: Record<string, unknown> = {}
    if (body.name !== undefined) update.name = body.name
    if (body.description !== undefined) update.description = body.description
    if (body.system_prompt !== undefined) update.system_prompt = body.system_prompt
    if (body.notification_config !== undefined) update.notification_config = body.notification_config

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase
      .from('agents')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[v1/agents/PATCH] error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await validateApiKey(req)
  if (!auth.valid) return auth.response!

  try {
    const { id } = await params
    const supabase = createSupabaseServiceClient()
    const { error } = await supabase.from('agents').delete().eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[v1/agents/DELETE] error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
