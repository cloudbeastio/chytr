'use client'

import { useState } from 'react'
import { createSupabaseClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Activity } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState<'google' | 'microsoft' | 'magic' | null>(null)
  const [magicSent, setMagicSent] = useState(false)
  const [error, setError] = useState('')

  const supabase = createSupabaseClient()

  async function signInWithGoogle() {
    setLoading('google')
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setError(error.message)
      setLoading(null)
    }
  }

  async function signInWithMicrosoft() {
    setLoading('microsoft')
    setError('')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'azure',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: 'email',
      },
    })
    if (error) {
      setError(error.message)
      setLoading(null)
    }
  }

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
            <CardTitle className="text-base">Continue with</CardTitle>
            <CardDescription>Choose your preferred sign-in method</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Google */}
            <Button
              variant="outline"
              className="w-full gap-3"
              onClick={signInWithGoogle}
              disabled={loading !== null}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              {loading === 'google' ? 'Redirecting…' : 'Continue with Google'}
            </Button>

            {/* Microsoft */}
            <Button
              variant="outline"
              className="w-full gap-3"
              onClick={signInWithMicrosoft}
              disabled={loading !== null}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path d="M11.4 2H2v9.4h9.4V2z" fill="#F25022" />
                <path d="M22 2h-9.4v9.4H22V2z" fill="#7FBA00" />
                <path d="M11.4 12.6H2V22h9.4v-9.4z" fill="#00A4EF" />
                <path d="M22 12.6h-9.4V22H22v-9.4z" fill="#FFB900" />
              </svg>
              {loading === 'microsoft' ? 'Redirecting…' : 'Continue with Microsoft'}
            </Button>

            <div className="flex items-center gap-3 py-1">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">or</span>
              <Separator className="flex-1" />
            </div>

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
