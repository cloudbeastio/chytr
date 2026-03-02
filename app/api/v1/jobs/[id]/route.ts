import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import { authenticateApiKey } from '@/lib/api-auth'

const ALLOWED_FIELDS = [
  'name',
  'cron_expression',
  'agent_id',
  'repo_id',
  'work_order_template',
  'description',
  'enabled',
]

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiKey(req)
    if (!auth) {
      return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
    }

    const { id } = await params
    const body = (await req.json()) as Record<string, unknown>

    const updates: Record<string, unknown> = {}
    for (const key of ALLOWED_FIELDS) {
      if (key in body) updates[key] = body[key]
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase
      .from('scheduled_jobs')
      .update(updates)
      .eq('id', id)
      .eq('user_id', auth.userId)
      .select()
      .single()

    if (error) {
      console.error('[v1/jobs PATCH]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ job: data })
  } catch (err) {
    console.error('[v1/jobs PATCH]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateApiKey(req)
    if (!auth) {
      return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
    }

    const { id } = await params
    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase
      .from('scheduled_jobs')
      .delete()
      .eq('id', id)
      .eq('user_id', auth.userId)
      .select('id')
      .single()

    if (error) {
      console.error('[v1/jobs DELETE]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[v1/jobs DELETE]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
