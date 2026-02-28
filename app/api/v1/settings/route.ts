import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/api-auth'
import { createSupabaseServiceClient } from '@/lib/supabase'

const SENSITIVE_KEYS = ['license_key', 'license_decoded']

export async function GET(req: NextRequest) {
  const auth = await validateApiKey(req)
  if (!auth.valid) return auth.response!

  try {
    const supabase = createSupabaseServiceClient()
    const url = new URL(req.url)
    const key = url.searchParams.get('key')

    if (key) {
      if (SENSITIVE_KEYS.includes(key)) {
        return NextResponse.json({ error: 'Cannot read sensitive key' }, { status: 403 })
      }
      const { data, error } = await supabase
        .from('instance_config')
        .select('key, value')
        .eq('key', key)
        .single()
      if (error || !data) return NextResponse.json({ error: 'Key not found' }, { status: 404 })
      return NextResponse.json(data)
    }

    const { data, error } = await supabase
      .from('instance_config')
      .select('key, updated_at')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const keys = (data ?? [])
      .filter((row: { key: string }) => !SENSITIVE_KEYS.includes(row.key))
      .map((row: { key: string; updated_at: string }) => ({
        key: row.key,
        updated_at: row.updated_at,
      }))

    return NextResponse.json({ keys })
  } catch (err) {
    console.error('[v1/settings/GET] error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await validateApiKey(req)
  if (!auth.valid) return auth.response!

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

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[v1/settings/POST] error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
