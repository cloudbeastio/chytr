'use client'

import { useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Activity } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState<'magic' | null>(null)
  const [magicSent, setMagicSent] = useState(false)
  const [error, setError] = useState('')

  const supabase = createSupabaseClient()

  // TODO: uncomment when Google/Microsoft OAuth credentials are configured in Supabase Dashboard
  // async function signInWithGoogle() {
  //   setLoading('google')
  //   setError('')
  //   const { error } = await supabase.auth.signInWithOAuth({
  //     provider: 'google',
  //     options: { redirectTo: `${window.location.origin}/auth/callback` },
  //   })
  //   if (error) { setError(error.message); setLoading(null) }
  // }
  // async function signInWithMicrosoft() {
  //   setLoading('microsoft')
  //   setError('')
  //   const { error } = await supabase.auth.signInWithOAuth({
  //     provider: 'azure',
  //     options: { redirectTo: `${window.location.origin}/auth/callback`, scopes: 'email' },
  //   })
  //   if (error) { setError(error.message); setLoading(null) }
  // }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading('magic')
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setError(error.message)
    } else {
      setMagicSent(true)
    }
    setLoading(null)
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary">
            <Activity className="h-5 w-5 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">chytr</h1>
          <p className="text-sm text-muted-foreground">Sign in to your workspace</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Sign in</CardTitle>
            <CardDescription>Enter your email to receive a magic link</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* TODO: restore Google + Microsoft OAuth buttons when provider credentials are configured */}

            {/* Magic link */}
            {magicSent ? (
              <Alert>
                <AlertDescription>
                  Magic link sent to <strong>{email}</strong>. Check your inbox.
                </AlertDescription>
              </Alert>
            ) : (
              <form onSubmit={sendMagicLink} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <Button
                  type="submit"
                  variant="secondary"
                  className="w-full"
                  disabled={loading !== null || !email.trim()}
                >
                  {loading === 'magic' ? 'Sending…' : 'Send magic link'}
                </Button>
              </form>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          <a
            href="https://www.chytr.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            chytr.ai
          </a>
        </p>
      </div>
    </div>
  )
}
