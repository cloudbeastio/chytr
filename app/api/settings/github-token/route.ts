import { NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/session'
import { createSupabaseServiceClient } from '@/lib/supabase'

const GITHUB_USER_TIMEOUT_MS = 5_000

export async function GET() {
  try {
    const userId = await getSessionUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createSupabaseServiceClient()
    const { data: configured, error: rpcError } = await supabase.rpc('user_has_github_credential', {
      p_user_id: userId,
    })
    if (rpcError) {
      console.error('[github-token] user_has_github_credential', rpcError)
      return NextResponse.json({ error: rpcError.message }, { status: 500 })
    }
    if (!configured) {
      return NextResponse.json({ configured: false })
    }

    const { data: token } = await supabase.rpc('get_user_github_token', { p_user_id: userId })
    let login: string | undefined
    if (token && typeof token === 'string') {
      try {
        const res = await fetch('https://api.github.com/user', {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' },
          signal: AbortSignal.timeout(GITHUB_USER_TIMEOUT_MS),
        })
        if (res.ok) {
          const user = (await res.json()) as { login?: string }
          login = user.login
        }
      } catch {
        // ignore; we still have configured true
      }
    }
    return NextResponse.json({ configured: true, login })
  } catch (err) {
    console.error('[github-token] GET error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const userId = await getSessionUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createSupabaseServiceClient()
    const { error } = await supabase.rpc('set_user_github_token', {
      p_user_id: userId,
      p_token: '',
    })
    if (error) {
      console.error('[github-token] DELETE set_user_github_token', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[github-token] DELETE error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
