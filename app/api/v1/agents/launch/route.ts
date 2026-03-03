import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase-server'
import { authenticateApiKey } from '@/lib/api-auth'
import { loadLicenseFromDB } from '@/lib/license-server'
import { getCursorApiKey, buildAgentPrompt } from '@/lib/cursor-api'

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateApiKey(req)
    if (!auth) {
      return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 })
    }

    const body = (await req.json()) as { chyt_id?: string }
    const chyt_id = body.chyt_id
    if (!chyt_id) {
      return NextResponse.json({ error: 'chyt_id required' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()

    const { data: woRow, error: woError } = await supabase
      .from('chyts')
      .select('id, source, user_id')
      .eq('id', chyt_id)
      .eq('user_id', auth.userId)
      .single()

    if (woError || !woRow) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
    }

    if (woRow.source === 'local') {
      return NextResponse.json({ ok: true, skipped: 'local source' })
    }

    const license = await loadLicenseFromDB()
    if (!license) {
      return NextResponse.json({ error: 'No valid license' }, { status: 403 })
    }

    const cursorApiKey = await getCursorApiKey()
    if (!cursorApiKey) {
      return NextResponse.json(
        { error: 'CURSOR_API_KEY not configured' },
        { status: 500 }
      )
    }

    const { data: wo } = await supabase.rpc('get_chyt', {
      p_chyt_id: chyt_id,
    })
    if (!wo) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
    }

    const prompt = buildAgentPrompt(wo as Record<string, unknown>)

    const cursorRes = await fetch('https://api.cursor.com/v1/agents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cursorApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        repo_url: (wo as { repo_url?: string }).repo_url,
        branch:
          (wo as { branch_name?: string }).branch_name ??
          (wo as { default_branch?: string }).default_branch ??
          'main',
      }),
    })

    if (!cursorRes.ok) {
      const errText = await cursorRes.text()
      console.error('[v1/agents/launch] Cursor API', cursorRes.status, errText)
      return NextResponse.json(
        { error: `Cursor API error: ${cursorRes.status}` },
        { status: 502 }
      )
    }

    const cursorData = (await cursorRes.json()) as { id?: string; agent_id?: string }
    const cursor_agent_id = cursorData.id ?? cursorData.agent_id

    await supabase
      .from('chyts')
      .update({
        status: 'running',
        cursor_agent_id: cursor_agent_id ?? null,
      })
      .eq('id', chyt_id)
      .eq('user_id', auth.userId)

    return NextResponse.json({ ok: true, cursor_agent_id })
  } catch (err) {
    console.error('[v1/agents/launch]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
