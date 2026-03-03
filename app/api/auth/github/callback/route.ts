import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/session'
import { cookies } from 'next/headers'
import { createSupabaseServiceClient } from '@/lib/supabase'

const STATE_COOKIE_NAME = 'gh_oauth_state'
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const GITHUB_TOKEN_TIMEOUT_MS = 10_000

export async function GET(req: NextRequest) {
  try {
    const userId = await getSessionUserId()
    if (!userId) {
      const settingsUrl = new URL('/settings', req.nextUrl.origin)
      settingsUrl.searchParams.set('github', 'error')
      return NextResponse.redirect(settingsUrl)
    }

    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    const cookieStore = await cookies()
    const storedState = cookieStore.get(STATE_COOKIE_NAME)?.value
    cookieStore.delete(STATE_COOKIE_NAME)

    if (!code || !state || state !== storedState) {
      console.error('[auth/github/callback] invalid state or missing code')
      const settingsUrl = new URL('/settings', req.nextUrl.origin)
      settingsUrl.searchParams.set('github', 'error')
      return NextResponse.redirect(settingsUrl)
    }

    const clientId = process.env.GITHUB_CLIENT_ID
    const clientSecret = process.env.GITHUB_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      console.error('[auth/github/callback] GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET not set')
      const settingsUrl = new URL('/settings', req.nextUrl.origin)
      settingsUrl.searchParams.set('github', 'error')
      return NextResponse.redirect(settingsUrl)
    }

    const baseUrl = process.env.CHYTR_PUBLIC_URL || req.nextUrl.origin
    const redirectUri = `${baseUrl.replace(/\/$/, '')}/api/auth/github/callback`

    const tokenRes = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
      signal: AbortSignal.timeout(GITHUB_TOKEN_TIMEOUT_MS),
    })

    if (!tokenRes.ok) {
      const text = await tokenRes.text().catch(() => '')
      console.error('[auth/github/callback] token exchange', tokenRes.status, text)
      const settingsUrl = new URL('/settings', req.nextUrl.origin)
      settingsUrl.searchParams.set('github', 'error')
      return NextResponse.redirect(settingsUrl)
    }

    const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string }
    const accessToken = tokenData.access_token
    if (tokenData.error || !accessToken) {
      console.error('[auth/github/callback] token response', tokenData.error || 'no access_token')
      const settingsUrl = new URL('/settings', req.nextUrl.origin)
      settingsUrl.searchParams.set('github', 'error')
      return NextResponse.redirect(settingsUrl)
    }

    const supabase = createSupabaseServiceClient()
    const { error } = await supabase.rpc('set_user_github_token', {
      p_user_id: userId,
      p_token: accessToken,
    })
    if (error) {
      console.error('[auth/github/callback] set_user_github_token', error)
      const settingsUrl = new URL('/settings', req.nextUrl.origin)
      settingsUrl.searchParams.set('github', 'error')
      return NextResponse.redirect(settingsUrl)
    }

    const settingsUrl = new URL('/settings', req.nextUrl.origin)
    settingsUrl.searchParams.set('github', 'connected')
    return NextResponse.redirect(settingsUrl)
  } catch (err) {
    console.error('[auth/github/callback] error', err)
    const settingsUrl = new URL('/settings', req.nextUrl.origin)
    settingsUrl.searchParams.set('github', 'error')
    return NextResponse.redirect(settingsUrl)
  }
}
