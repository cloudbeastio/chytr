'use client'

import { useState, useEffect } from 'react'
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
import { RefreshCw, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
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

function LicenseTab() {
  const [license, setLicense] = useState<LicensePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/license/info')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setLicense(d as LicensePayload) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">License</CardTitle>
        <CardDescription>Current license information for this instance</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !license ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <XCircle className="h-4 w-4 text-red-400" />
            No active license. Visit{' '}
            <a
              href="https://www.chytr.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              chytr.ai
            </a>{' '}
            to activate.
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
      </CardContent>
    </Card>
  )
}

// ─── API Keys Tab ─────────────────────────────────────────────────────────────

function ApiKeysTab() {
  const [cursorKey, setCursorKey] = useState('')
  const [githubToken, setGithubToken] = useState('')
  const [cursorState, setCursorState] = useState<SaveState>(IDLE_SAVE)
  const [githubState, setGithubState] = useState<SaveState>(IDLE_SAVE)

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

  async function saveGithubToken() {
    setGithubState({ saving: true, success: false, error: null })
    try {
      await saveSetting('GITHUB_TOKEN', githubToken)
      setGithubState({ saving: false, success: true, error: null })
      setTimeout(() => setGithubState(IDLE_SAVE), 3000)
    } catch (err) {
      setGithubState({ saving: false, success: false, error: err instanceof Error ? err.message : 'Error' })
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
          <CardTitle className="text-base">GitHub Token</CardTitle>
          <CardDescription>Used for repo access and PR creation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="github-token">GITHUB_TOKEN</Label>
            <Input
              id="github-token"
              type="password"
              placeholder="ghp_…"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={saveGithubToken} disabled={githubState.saving || !githubToken}>
              Save
            </Button>
            <SaveFeedback state={githubState} />
          </div>
        </CardContent>
      </Card>
    </div>
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
          <TabsContent value="danger">
            <DangerTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
