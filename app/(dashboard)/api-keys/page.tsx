'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Key, Plus, Trash2, Copy, Check } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface ApiKeyRow {
  id: string
  key_prefix: string
  name: string
  last_used_at: string | null
  created_at: string
  revoked: boolean
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [newKeyName, setNewKeyName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const loadKeys = () => {
    fetch('/api/keys')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.keys) setKeys(d.keys) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadKeys() }, [])

  async function createKey() {
    if (!newKeyName.trim()) return
    setCreating(true)
    setCreatedKey(null)
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setCreatedKey(data.api_key)
      setNewKeyName('')
      loadKeys()
    } catch (err) {
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  async function revokeKey(id: string) {
    setRevokingId(id)
    try {
      await fetch(`/api/keys/${id}`, { method: 'DELETE' })
      loadKeys()
    } catch (err) {
      console.error(err)
    } finally {
      setRevokingId(null)
    }
  }

  async function copyKey() {
    if (!createdKey) return
    await navigator.clipboard.writeText(createdKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const activeKeys = keys.filter((k) => !k.revoked)
  const revokedKeys = keys.filter((k) => k.revoked)

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">API Keys</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Authenticate hooks and scripts with Bearer tokens. Set <code className="text-xs bg-muted px-1 py-0.5 rounded">CHYTR_API_KEY</code> in your env.
        </p>
      </div>

      {/* Create new key */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create API Key
          </CardTitle>
          <CardDescription>Give the key a name so you can identify it later.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="space-y-1.5 flex-1">
              <Label htmlFor="key-name">Key name</Label>
              <Input
                id="key-name"
                placeholder="e.g. Local dev, CI runner"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') createKey() }}
              />
            </div>
            <Button onClick={createKey} disabled={creating || !newKeyName.trim()}>
              {creating ? 'Creating…' : 'Create'}
            </Button>
          </div>

          {createdKey && (
            <div className="rounded-lg border border-green-800/40 bg-green-950/20 p-4 space-y-2">
              <p className="text-xs text-green-400 font-medium">
                Copy this key now — it will not be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono bg-muted rounded px-3 py-2 break-all">
                  {createdKey}
                </code>
                <Button size="icon" variant="outline" onClick={copyKey} className="shrink-0">
                  {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active keys */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            Active Keys
            {activeKeys.length > 0 && (
              <Badge variant="secondary" className="ml-1">{activeKeys.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : activeKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active keys. Create one above.</p>
          ) : (
            <div className="divide-y">
              {activeKeys.map((k) => (
                <div key={k.id} className="flex items-center gap-3 py-3">
                  <Key className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{k.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {k.key_prefix}••••••••••••••••••••••••••••
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">
                      {k.last_used_at
                        ? `Last used ${new Date(k.last_used_at).toLocaleDateString()}`
                        : 'Never used'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(k.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive shrink-0"
                        disabled={revokingId === k.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Revoke "{k.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Any scripts using this key will stop working immediately. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => revokeKey(k.id)}
                        >
                          Revoke key
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revoked keys (collapsed) */}
      {revokedKeys.length > 0 && (
        <Card className="opacity-60">
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">
              Revoked Keys ({revokedKeys.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {revokedKeys.map((k) => (
                <div key={k.id} className="flex items-center gap-3 py-2">
                  <Key className="h-4 w-4 text-muted-foreground shrink-0" />
                  <p className="text-sm line-through text-muted-foreground flex-1">{k.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{k.key_prefix}…</p>
                  <Badge variant="outline" className="text-xs shrink-0">Revoked</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
