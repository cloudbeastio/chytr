'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'

export default function ActivatePage() {
  const router = useRouter()
  const [key, setKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleActivate(e: React.FormEvent) {
    e.preventDefault()
    if (!key.trim()) return
    setLoading(true)
    setError('')

    const res = await fetch('/api/license/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: key.trim() }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Invalid license key')
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">chytr</h1>
          <p className="text-muted-foreground">Work orders for AI agents</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Activate your instance</CardTitle>
            <CardDescription>
              Enter your license key to get started. Don&apos;t have one?{' '}
              <a
                href="https://www.chytr.ai/register"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4"
              >
                Register for free at chytr.ai
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleActivate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="key">License key</Label>
                <Input
                  id="key"
                  type="text"
                  placeholder="chytr_xxxxxxxxxxxxxxxxxxxxxxxx"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  className="font-mono text-sm"
                  autoFocus
                />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" disabled={loading || !key.trim()}>
                {loading ? 'Activating…' : 'Activate'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Self-hosted instance · License issued by{' '}
          <a href="https://www.chytr.ai" target="_blank" rel="noopener noreferrer" className="underline">
            chytr.ai
          </a>
        </p>
      </div>
    </div>
  )
}
