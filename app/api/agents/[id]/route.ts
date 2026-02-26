import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const body = (await req.json()) as {
      name?: string
      description?: string | null
      system_prompt?: string | null
      notification_config?: unknown
    }

    const update: Record<string, unknown> = {}
    if (body.name !== undefined) update.name = body.name
    if (body.description !== undefined) update.description = body.description
    if (body.system_prompt !== undefined) update.system_prompt = body.system_prompt
    if (body.notification_config !== undefined) update.notification_config = body.notification_config

    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase
      .from('agents')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[agents/patch] error', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[agents/patch] unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
