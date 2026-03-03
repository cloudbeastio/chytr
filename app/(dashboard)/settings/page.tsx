'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
import { RefreshCw, CheckCircle, AlertTriangle, Key, Plus, Trash2, Copy, Check, Github } from 'lucide-react'
import type { LicensePayload } from '@/lib/license'

interface SaveState {
  saving: boolean
  success: boolean
  error: string | null
}

const IDLE_SAVE: SaveState = { saving: false, success: false, error: null }

async function saveSetting(key: string, value: string): Promise<void> {
  const res = await fetch('/api/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error ?? 'Failed to save')
  }
}

function SaveFeedback({ state }: { state: SaveState }) {
  if (state.saving) return <span className="text-xs text-muted-foreground">Saving…</span>
  if (state.success) return <span className="text-xs text-green-400 flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Saved</span>
  if (state.error) return <span className="text-xs text-red-400">{state.error}</span>
  return null
}

// ─── License Tab ─────────────────────────────────────────────────────────────

interface LicenseKeyRow {
  id: string
  key_prefix: string
  name: string
  tier: string
  created_at: string
  revoked: boolean
}

function LicenseTab() {
  const [license, setLicense] = useState<LicensePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [licenseKeys, setLicenseKeys] = useState<LicenseKeyRow[]>([])
  const [keysLoading, setKeysLoading] = useState(true)
  const [newKeyName, setNewKeyName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createdLicenseKey, setCreatedLicenseKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const loadLicenseKeys = () => {
    fetch('/api/license/keys')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.keys) setLicenseKeys(d.keys) })
      .catch(() => {})
      .finally(() => setKeysLoading(false))
  }

  useEffect(() => {
    fetch('/api/license/info')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setLicense(d as LicensePayload) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadLicenseKeys() }, [])

  async function handleRefresh() {
    setRefreshing(true)
    setRefreshError(null)
    try {
      const res = await fetch('https://api.chytr.ai/v1/license/refresh', { method: 'POST' })
      if (!res.ok) throw new Error('Refresh failed')
      const data = (await res.json()) as { license?: LicensePayload }
      if (data.license) setLicense(data.license)
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  const TIER_VARIANT: Record<string, 'default' | 'secondary' | 'outline'> = {
    free: 'secondary',
    pro: 'default',
    team: 'default',
  }

  async function createLicenseKey() {
    if (!newKeyName.trim()) return
    setCreating(true)
    setCreatedLicenseKey(null)
    try {
      const res = await fetch('/api/license/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setCreatedLicenseKey(data.license_key)
      setNewKeyName('')
      loadLicenseKeys()
    } catch (err) {
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  async function revokeLicenseKey(id: string) {
    setRevokingId(id)
    try {
      await fetch(`/api/license/keys/${id}`, { method: 'DELETE' })
      loadLicenseKeys()
    } catch (err) {
      console.error(err)
    } finally {
      setRevokingId(null)
    }
  }

  async function copyLicenseKey() {
    if (!createdLicenseKey) return
    await navigator.clipboard.writeText(createdLicenseKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const activeLicenseKeys = licenseKeys.filter((k) => !k.revoked)
  const revokedLicenseKeys = licenseKeys.filter((k) => k.revoked)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">License</CardTitle>
          <CardDescription>Current license information for this instance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !license ? (
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                You are currently using the hosted version of chytr.ai and agree to the{' '}
                <a
                  href="/terms"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  licensing agreement
                </a>
                . If you would like to self-host Chytr for ultimate privacy, generate a Chytr
                license key below.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div className="text-muted-foreground">Email</div>
                <div>{license.email}</div>

                <div className="text-muted-foreground">Tier</div>
                <div>
                  <Badge variant={TIER_VARIANT[license.tier] ?? 'secondary'} className="capitalize">
                    {license.tier}
                  </Badge>
                </div>

                <div className="text-muted-foreground">Expires</div>
                <div>
                  {license.exp
                    ? new Date(license.exp * 1000).toLocaleDateString()
                    : '—'}
                </div>

                <div className="text-muted-foreground">Knowledge limit</div>
                <div>{license.limits.knowledge_entries.toLocaleString()} entries</div>

                <div className="text-muted-foreground">Log retention</div>
                <div>{license.limits.log_retention_days} days</div>

                <div className="text-muted-foreground">Agent repos</div>
                <div>{license.limits.agent_repos}</div>
              </div>

              <Separator />

              <div>
                <p className="text-xs text-muted-foreground mb-2">Features</p>
                <div className="flex flex-wrap gap-1.5">
                  {license.features.map((f) => (
                    <Badge key={f} variant="secondary" className="text-[10px] px-1.5 py-0">
                      {f}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {license && (
            <div className="flex items-center gap-3 pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh License
              </Button>
              {refreshError && (
                <span className="text-xs text-red-400">{refreshError}</span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create license key */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create license key
          </CardTitle>
          <CardDescription>Generate a key to activate a self-hosted instance. Give it a name to identify it later.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-2">
            <div className="space-y-1.5 flex-1">
              <Label htmlFor="license-key-name">Key name</Label>
              <Input
                id="license-key-name"
                placeholder="e.g. Production, Staging"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') createLicenseKey() }}
              />
            </div>
            <Button onClick={createLicenseKey} disabled={creating || !newKeyName.trim()}>
              {creating ? 'Generating…' : 'Generate'}
            </Button>
          </div>

          {createdLicenseKey && (
            <div className="rounded-lg border border-green-800/40 bg-green-950/20 p-4 space-y-2">
              <p className="text-xs text-green-400 font-medium">
                Copy this key now — it will not be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm font-mono bg-muted rounded px-3 py-2 break-all">
                  {createdLicenseKey}
                </code>
                <Button size="icon" variant="outline" onClick={copyLicenseKey} className="shrink-0">
                  {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active license keys */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            Your license keys
            {activeLicenseKeys.length > 0 && (
              <Badge variant="secondary" className="ml-1">{activeLicenseKeys.length}</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {keysLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : activeLicenseKeys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active keys. Generate one above.</p>
          ) : (
            <div className="divide-y">
              {activeLicenseKeys.map((k) => (
                <div key={k.id} className="flex items-center gap-3 py-3">
                  <Key className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{k.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {k.key_prefix}••••••••••••••••••••••••••••
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] capitalize shrink-0">{k.tier}</Badge>
                  <p className="text-xs text-muted-foreground shrink-0">
                    Created {new Date(k.created_at).toLocaleDateString()}
                  </p>
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
                        <AlertDialogTitle>Revoke &quot;{k.name}&quot;?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Any self-hosted instance using this key will lose access. This cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => revokeLicenseKey(k.id)}
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

      {revokedLicenseKeys.length > 0 && (
        <Card className="opacity-60">
          <CardHeader>
            <CardTitle className="text-base text-muted-foreground">
              Revoked keys ({revokedLicenseKeys.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {revokedLicenseKeys.map((k) => (
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

// ─── API Keys Tab ─────────────────────────────────────────────────────────────

function ApiKeysTab() {
  const searchParams = useSearchParams()
  const [cursorKey, setCursorKey] = useState('')
  const [cursorState, setCursorState] = useState<SaveState>(IDLE_SAVE)
  const [githubConfigured, setGithubConfigured] = useState(false)
  const [githubLogin, setGithubLogin] = useState<string | null>(null)
  const [githubLoading, setGithubLoading] = useState(true)
  const [githubDisconnecting, setGithubDisconnecting] = useState(false)
  const [githubMessage, setGithubMessage] = useState<'connected' | 'error' | null>(null)

  useEffect(() => {
    const gh = searchParams.get('github')
    if (gh === 'connected' || gh === 'error') {
      setGithubMessage(gh)
      window.history.replaceState({}, '', '/settings')
    }
  }, [searchParams])

  useEffect(() => {
    fetch('/api/settings/github-token')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.configured === 'boolean') {
          setGithubConfigured(d.configured)
          setGithubLogin(d.login ?? null)
        }
      })
      .catch(() => {})
      .finally(() => setGithubLoading(false))
  }, [])

  async function disconnectGithub() {
    setGithubDisconnecting(true)
    try {
      const res = await fetch('/api/settings/github-token', { method: 'DELETE' })
      if (res.ok) {
        setGithubConfigured(false)
        setGithubLogin(null)
      }
    } catch {
      // ignore
    } finally {
      setGithubDisconnecting(false)
    }
  }

  async function saveCursorKey() {
    setCursorState({ saving: true, success: false, error: null })
    try {
      await saveSetting('CURSOR_API_KEY', cursorKey)
      setCursorState({ saving: false, success: true, error: null })
      setTimeout(() => setCursorState(IDLE_SAVE), 3000)
    } catch (err) {
      setCursorState({ saving: false, success: false, error: err instanceof Error ? err.message : 'Error' })
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cursor API Key</CardTitle>
          <CardDescription>Used to launch Cursor Cloud Agents</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cursor-key">CURSOR_API_KEY</Label>
            <Input
              id="cursor-key"
              type="password"
              placeholder="cursor_…"
              value={cursorKey}
              onChange={(e) => setCursorKey(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={saveCursorKey} disabled={cursorState.saving || !cursorKey}>
              Save
            </Button>
            <SaveFeedback state={cursorState} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Github className="h-4 w-4" />
            GitHub
          </CardTitle>
          <CardDescription>Connect GitHub to link repos and create agents. Used for repo access.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {githubMessage === 'connected' && (
            <p className="text-xs text-green-400 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> Connected successfully.
            </p>
          )}
          {githubMessage === 'error' && (
            <p className="text-xs text-red-400">GitHub connection failed. Try again.</p>
          )}
          {githubLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : githubConfigured ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Connected{githubLogin ? ` as ${githubLogin}` : ''}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={disconnectGithub}
                disabled={githubDisconnecting}
              >
                {githubDisconnecting ? 'Disconnecting…' : 'Disconnect'}
              </Button>
            </div>
          ) : (
            <Button size="sm" asChild>
              <a href="/api/auth/github">Connect GitHub</a>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Alerts Tab ────────────────────────────────────────────────────────────────

function AlertsTab() {
  const [costThresholdUsd, setCostThresholdUsd] = useState('')
  const [state, setState] = useState<SaveState>(IDLE_SAVE)

  async function handleSave() {
    const num = costThresholdUsd.trim() ? parseFloat(costThresholdUsd) : undefined
    setState({ saving: true, success: false, error: null })
    try {
      await saveSetting(
        'alert_rules',
        JSON.stringify({ costThresholdUsd: num != null && !Number.isNaN(num) ? num : null })
      )
      setState({ saving: false, success: true, error: null })
      setTimeout(() => setState(IDLE_SAVE), 3000)
    } catch (err) {
      setState({ saving: false, success: false, error: err instanceof Error ? err.message : 'Error' })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Spend alerts</CardTitle>
        <CardDescription>
          Optional daily cost threshold. When exceeded, an alert can be sent (Slack / in-app delivery coming soon).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="cost-threshold">Daily cost threshold (USD)</Label>
          <Input
            id="cost-threshold"
            type="number"
            min={0}
            step={0.01}
            placeholder="e.g. 10"
            value={costThresholdUsd}
            onChange={(e) => setCostThresholdUsd(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={handleSave} disabled={state.saving}>
            Save
          </Button>
          <SaveFeedback state={state} />
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Notifications Tab ────────────────────────────────────────────────────────

function NotificationsTab() {
  const [channel, setChannel] = useState<'slack' | 'agentmail'>('slack')
  const [slackWebhook, setSlackWebhook] = useState('')
  const [agentmailInbox, setAgentmailInbox] = useState('')
  const [saveState, setSaveState] = useState<SaveState>(IDLE_SAVE)

  async function handleSave() {
    setSaveState({ saving: true, success: false, error: null })
    try {
      await Promise.all([
        saveSetting('NOTIFICATION_CHANNEL', channel),
        saveSetting('SLACK_WEBHOOK_URL', slackWebhook),
        saveSetting('AGENTMAIL_INBOX', agentmailInbox),
      ])
      setSaveState({ saving: false, success: true, error: null })
      setTimeout(() => setSaveState(IDLE_SAVE), 3000)
    } catch (err) {
      setSaveState({ saving: false, success: false, error: err instanceof Error ? err.message : 'Error' })
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Notifications</CardTitle>
        <CardDescription>Where agents send approval requests and alerts</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Preferred channel</Label>
          <Select
            value={channel}
            onValueChange={(v) => setChannel(v as 'slack' | 'agentmail')}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="slack">Slack</SelectItem>
              <SelectItem value="agentmail">AgentMail</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="slack-webhook">Slack Webhook URL</Label>
          <Input
            id="slack-webhook"
            placeholder="https://hooks.slack.com/services/…"
            value={slackWebhook}
            onChange={(e) => setSlackWebhook(e.target.value)}
            disabled={channel !== 'slack'}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="agentmail-inbox">AgentMail Inbox</Label>
          <Input
            id="agentmail-inbox"
            placeholder="inbox-id or email@agentmail.to"
            value={agentmailInbox}
            onChange={(e) => setAgentmailInbox(e.target.value)}
            disabled={channel !== 'agentmail'}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button size="sm" onClick={handleSave} disabled={saveState.saving}>
            Save
          </Button>
          <SaveFeedback state={saveState} />
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Danger Zone Tab ──────────────────────────────────────────────────────────

function DangerTab() {
  const [resetting, setResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  async function handleReset() {
    setResetting(true)
    setResetError(null)
    try {
      const res = await fetch('/api/instance/reset', { method: 'POST' })
      if (!res.ok) throw new Error('Reset failed')
      window.location.href = '/activate'
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Reset failed')
      setResetting(false)
    }
  }

  return (
    <Card className="border-red-900/50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2 text-red-400">
          <AlertTriangle className="h-4 w-4" />
          Danger Zone
        </CardTitle>
        <CardDescription>Irreversible actions. Proceed with caution.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4 p-4 border border-red-900/40 rounded-lg bg-red-950/10">
          <div>
            <p className="text-sm font-medium">Reset Instance</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Deletes all agents, work orders, knowledge, and config. Cannot be undone.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={resetting}>
                {resetting ? 'Resetting…' : 'Reset'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset this instance?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all data including agents, work orders, knowledge
                  entries, and configuration. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={handleReset}
                >
                  Yes, reset everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        {resetError && <p className="text-xs text-red-400">{resetError}</p>}
      </CardContent>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Configure your chytr instance
        </p>
      </div>

      <Tabs defaultValue="license">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="license">License</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="danger">Danger</TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="license">
            <LicenseTab />
          </TabsContent>
          <TabsContent value="api-keys">
            <ApiKeysTab />
          </TabsContent>
          <TabsContent value="notifications">
            <NotificationsTab />
          </TabsContent>
          <TabsContent value="alerts">
            <AlertsTab />
          </TabsContent>
          <TabsContent value="danger">
            <DangerTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
