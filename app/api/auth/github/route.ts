import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/session'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize'
const STATE_COOKIE_NAME = 'gh_oauth_state'
const STATE_COOKIE_MAX_AGE = 600

export async function GET(req: NextRequest) {
  try {
    const userId = await getSessionUserId()
    if (!userId) {
      const loginUrl = new URL('/login', req.nextUrl.origin)
      loginUrl.searchParams.set('redirectTo', '/settings')
      return NextResponse.redirect(loginUrl)
    }

    const clientId = process.env.GITHUB_CLIENT_ID
    if (!clientId) {
      console.error('[auth/github] GITHUB_CLIENT_ID not set')
      const settingsUrl = new URL('/settings', req.nextUrl.origin)
      settingsUrl.searchParams.set('github', 'error')
      return NextResponse.redirect(settingsUrl)
    }

    const baseUrl = process.env.CHYTR_PUBLIC_URL || req.nextUrl.origin
    const redirectUri = `${baseUrl.replace(/\/$/, '')}/api/auth/github/callback`
    const state = randomBytes(24).toString('hex')

    const cookieStore = await cookies()
    cookieStore.set(STATE_COOKIE_NAME, state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: STATE_COOKIE_MAX_AGE,
    })

    const url = new URL(GITHUB_AUTH_URL)
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('scope', 'repo,read:user')
    url.searchParams.set('state', state)

    return NextResponse.redirect(url.toString())
  } catch (err) {
    console.error('[auth/github] error', err)
    const settingsUrl = new URL('/settings', req.nextUrl.origin)
    settingsUrl.searchParams.set('github', 'error')
    return NextResponse.redirect(settingsUrl)
  }
}
