import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { key?: string; value?: string }

    if (!body.key || typeof body.key !== 'string') {
      return NextResponse.json({ error: 'key is required' }, { status: 400 })
    }
    if (typeof body.value !== 'string') {
      return NextResponse.json({ error: 'value must be a string' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()
    const { error } = await supabase
      .from('instance_config')
      .upsert({ key: body.key, value: body.value })

    if (error) {
      console.error('[settings] upsert error', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[settings] unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
