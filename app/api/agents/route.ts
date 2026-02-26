import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      name?: string
      description?: string | null
      system_prompt?: string | null
      type?: string | null
      notification_config?: unknown
    }

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
        notification_config: (body.notification_config ?? {}) as import('@/lib/database.types').Json,
        status: 'offline',
      })
      .select()
      .single()

    if (error) {
      console.error('[agents] insert error', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    console.error('[agents] unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
