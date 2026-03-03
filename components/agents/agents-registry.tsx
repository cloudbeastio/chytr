'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Plus, Bot } from 'lucide-react'
import { AgentCard, type AgentStatsSummary } from './agent-card'
import { cn } from '@/lib/utils'
import type { Agent, AgentStatus } from '@/lib/database.types'

interface AgentsRegistryProps {
  agents: Agent[]
  statsMap: Record<string, AgentStatsSummary>
  skillsMap: Record<string, string[]>
  repoCounts: Record<string, number>
}

const STATUS_CONFIG: Record<AgentStatus, { dot: string; label: string }> = {
  active: { dot: 'bg-green-500', label: 'Active' },
  idle: { dot: 'bg-yellow-400', label: 'Idle' },
  offline: { dot: 'bg-muted-foreground/50', label: 'Offline' },
  error: { dot: 'bg-red-500', label: 'Error' },
}

export function AgentsRegistry({ agents, statsMap, skillsMap, repoCounts }: AgentsRegistryProps) {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [repoUrl, setRepoUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Detail sheet state for editing
  const [detailForm, setDetailForm] = useState<Partial<Agent>>({})
  const [detailSaving, setDetailSaving] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [detailSuccess, setDetailSuccess] = useState(false)

  function openDetail(agent: Agent) {
    setSelectedAgent(agent)
    setDetailForm({
      name: agent.name,
      description: agent.description ?? '',
      system_prompt: agent.system_prompt ?? '',
      notification_config: agent.notification_config,
    })
    setDetailError(null)
    setDetailSuccess(false)
  }

  async function handleLinkRepo() {
    const url = repoUrl.trim()
    if (!url) {
      setError('Enter a GitHub repo URL')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repo_url: url }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? 'Failed to link repo')
      }
      setNewDialogOpen(false)
      setRepoUrl('')
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  async function handleDetailSave() {
    if (!selectedAgent) return

    let notifConfig: unknown = selectedAgent.notification_config
    const notifStr = typeof detailForm.notification_config === 'string'
      ? detailForm.notification_config
      : JSON.stringify(detailForm.notification_config ?? {}, null, 2)

    try {
      notifConfig = JSON.parse(notifStr)
    } catch {
      setDetailError('Notification config must be valid JSON')
      return
    }

    setDetailSaving(true)
    setDetailError(null)
    setDetailSuccess(false)
    try {
      const res = await fetch(`/api/agents/${selectedAgent.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: detailForm.name,
          description: detailForm.description,
          system_prompt: detailForm.system_prompt,
          notification_config: notifConfig,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Failed to save')
      }
      setDetailSuccess(true)
      setTimeout(() => setDetailSuccess(false), 3000)
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setDetailSaving(false)
    }
  }

  const notifConfigStr =
    detailForm.notification_config && typeof detailForm.notification_config !== 'string'
      ? JSON.stringify(detailForm.notification_config, null, 2)
      : (detailForm.notification_config as string) ?? '{}'

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{agents.length} registered</p>
        <Button size="sm" onClick={() => setNewDialogOpen(true)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Link repo
        </Button>
      </div>

      {/* Grid */}
      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed rounded-lg">
          <Bot className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">No agents yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Link a GitHub repo to create an agent.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              stats={statsMap[agent.id] ?? null}
              skills={skillsMap[agent.id] ?? []}
              repoCount={repoCounts[agent.id] ?? 0}
              onSelect={openDetail}
            />
          ))}
        </div>
      )}

      {/* Link GitHub repo dialog */}
      <Dialog open={newDialogOpen} onOpenChange={(o) => { setNewDialogOpen(o); if (!o) setError(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Link GitHub repo</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="repo-url">GitHub repo URL</Label>
              <Input
                id="repo-url"
                placeholder="https://github.com/owner/repo or owner/repo"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleLinkRepo} disabled={saving}>
              {saving ? 'Linking…' : 'Link repo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Agent Detail Sheet */}
      <Sheet open={!!selectedAgent} onOpenChange={(o) => { if (!o) setSelectedAgent(null) }}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedAgent && (
            <>
              <SheetHeader className="space-y-1 pr-6">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'inline-block w-2 h-2 rounded-full shrink-0',
                      STATUS_CONFIG[selectedAgent.status]?.dot ?? 'bg-muted-foreground/50'
                    )}
                  />
                  <SheetTitle>{selectedAgent.name}</SheetTitle>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                    {selectedAgent.type ?? 'unknown'}
                  </Badge>
                </div>
                <SheetDescription className="text-xs">
                  ID: {selectedAgent.id}
                </SheetDescription>
              </SheetHeader>

              <Separator className="my-4" />

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="detail-name">Name</Label>
                  <Input
                    id="detail-name"
                    value={detailForm.name ?? ''}
                    onChange={(e) => setDetailForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="detail-desc">Description</Label>
                  <Input
                    id="detail-desc"
                    value={(detailForm.description as string) ?? ''}
                    onChange={(e) => setDetailForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Optional description"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="detail-prompt">System Prompt</Label>
                  <Textarea
                    id="detail-prompt"
                    rows={6}
                    value={(detailForm.system_prompt as string) ?? ''}
                    onChange={(e) =>
                      setDetailForm((f) => ({ ...f, system_prompt: e.target.value }))
                    }
                    placeholder="System prompt..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="detail-notif">Notification Config (JSON)</Label>
                  <Textarea
                    id="detail-notif"
                    rows={5}
                    className="font-mono text-xs"
                    value={notifConfigStr}
                    onChange={(e) =>
                      setDetailForm((f) => ({ ...f, notification_config: e.target.value as unknown as typeof f.notification_config }))
                    }
                  />
                </div>

                {detailError && <p className="text-xs text-red-400">{detailError}</p>}
                {detailSuccess && <p className="text-xs text-green-400">Saved successfully</p>}

                <Button onClick={handleDetailSave} disabled={detailSaving} className="w-full">
                  {detailSaving ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}
