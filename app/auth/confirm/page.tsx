'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function parseHashParams(hash: string): Record<string, string> {
  const params: Record<string, string> = {}
  hash
    .slice(1)
    .split('&')
    .forEach((p) => {
      const [k, v] = p.split('=')
      if (k && v) params[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '))
    })
  return params
}

export default function AuthConfirmPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')

  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    if (!hash) {
      router.replace('/login?error=auth_failed')
      return
    }

    const params = parseHashParams(hash)
    const access_token = params.access_token
    const refresh_token = params.refresh_token

    if (!access_token || !refresh_token) {
      router.replace('/login?error=auth_failed')
      return
    }

    const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    supabase.auth
      .setSession({ access_token, refresh_token })
      .then(({ error }) => {
        if (error) {
          setStatus('error')
          router.replace('/login?error=auth_failed')
        } else {
          setStatus('ok')
          router.replace('/dashboard')
        }
      })
      .catch(() => {
        setStatus('error')
        router.replace('/login?error=auth_failed')
      })
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground">
        {status === 'loading' && 'Signing you in...'}
        {status === 'ok' && 'Redirecting...'}
        {status === 'error' && 'Something went wrong. Redirecting to login.'}
      </p>
    </div>
  )
}
