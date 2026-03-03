'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, ChevronLeft } from 'lucide-react'
import type { WorkOrder } from '@/lib/database.types'
import type { Agent, AgentRepo } from '@/lib/database.types'

export interface WorkLine {
  id?: string
  title: string
  definition_of_done?: string
}

interface WorkOrderFormProps {
  agents: Pick<Agent, 'id' | 'name'>[]
  repos: Pick<AgentRepo, 'id' | 'agent_id' | 'repo_url'>[]
  workOrder?: WorkOrder | null
  isEdit: boolean
}

function parseLines(raw: unknown): WorkLine[] {
  if (!Array.isArray(raw)) return []
  return (raw as WorkLine[]).map((l) => ({
    id: typeof l.id === 'string' ? l.id : undefined,
    title: typeof l.title === 'string' ? l.title : '',
    definition_of_done: typeof l.definition_of_done === 'string' ? l.definition_of_done : '',
  }))
}

function parseJsonField(raw: unknown): string {
  if (raw == null) return ''
  if (typeof raw === 'string') return raw
  try {
    return JSON.stringify(raw, null, 2)
  } catch {
    return ''
  }
}

export function WorkOrderForm({
  agents,
  repos,
  workOrder,
  isEdit,
}: WorkOrderFormProps) {
  const router = useRouter()
  const filteredRepos = workOrder?.agent_id
    ? repos.filter((r) => r.agent_id === workOrder.agent_id)
    : repos

  const [objective, setObjective] = useState('')
  const [agentId, setAgentId] = useState('')
  const [repoId, setRepoId] = useState('')
  const [branchName, setBranchName] = useState('')
  const [lines, setLines] = useState<WorkLine[]>([])
  const [constraintsJson, setConstraintsJson] = useState('')
  const [explorationHintsJson, setExplorationHintsJson] = useState('')
  const [verificationJson, setVerificationJson] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (workOrder) {
      setObjective(workOrder.objective ?? '')
      setAgentId(workOrder.agent_id ?? '')
      setRepoId(workOrder.repo_id ?? '')
      setBranchName(workOrder.branch_name ?? '')
      setLines(parseLines(workOrder.lines))
      setConstraintsJson(parseJsonField(workOrder.constraints))
      setExplorationHintsJson(parseJsonField(workOrder.exploration_hints))
      setVerificationJson(parseJsonField(workOrder.verification))
    } else {
      setObjective('')
      setAgentId('')
      setRepoId('')
      setBranchName('')
      setLines([])
      setConstraintsJson('')
      setExplorationHintsJson('')
      setVerificationJson('')
    }
    setError(null)
  }, [workOrder])

  const currentRepos = agentId ? repos.filter((r) => r.agent_id === agentId) : repos

  function addLine() {
    setLines((prev) => [...prev, { title: '', definition_of_done: '' }])
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateLine(idx: number, field: keyof WorkLine, value: string) {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l))
    )
  }

  function parseOptionalJson(value: string): Record<string, unknown> | null {
    const t = value.trim()
    if (!t) return null
    try {
      return JSON.parse(t) as Record<string, unknown>
    } catch {
      return null
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!objective.trim() && lines.every((l) => !l.title.trim())) {
      setError('Objective or at least one work item is required')
      return
    }

    const constraints = parseOptionalJson(constraintsJson)
    const exploration_hints = parseOptionalJson(explorationHintsJson)
    const verification = parseOptionalJson(verificationJson)
    if (constraintsJson.trim() && constraints === null) {
      setError('Constraints must be valid JSON')
      return
    }
    if (explorationHintsJson.trim() && exploration_hints === null) {
      setError('Exploration hints must be valid JSON')
      return
    }
    if (verificationJson.trim() && verification === null) {
      setError('Verification must be valid JSON')
      return
    }

    const payload = {
      objective: objective.trim() || null,
      agent_id: agentId || null,
      repo_id: repoId || null,
      branch_name: branchName.trim() || null,
      lines: lines.filter((l) => l.title.trim()).map((l) => ({
        ...(l.id ? { id: l.id } : {}),
        title: l.title.trim(),
        ...(l.definition_of_done ? { definition_of_done: l.definition_of_done.trim() } : {}),
      })),
      constraints,
      exploration_hints: exploration_hints ?? undefined,
      verification: verification ?? undefined,
    }

    setSaving(true)
    try {
      if (isEdit && workOrder?.id) {
        const res = await fetch(`/api/work-orders/${workOrder.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError((data as { error?: string }).error ?? 'Update failed')
          return
        }
        router.push(`/work-orders/${workOrder.id}`)
        router.refresh()
      } else {
        const res = await fetch('/api/work-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError((data as { error?: string }).error ?? 'Create failed')
          return
        }
        const id = (data as { id?: string }).id
        if (id) {
          router.push(`/work-orders/${id}`)
        } else {
          router.push('/work-orders')
        }
        router.refresh()
      }
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" asChild>
          <Link href={workOrder ? `/work-orders/${workOrder.id}` : '/work-orders'}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">
          {isEdit ? 'Edit Work Order' : 'New Work Order'}
        </h1>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="wo-objective">Objective</Label>
        <Textarea
          id="wo-objective"
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          placeholder="High-level goal for the agent"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Agent</Label>
          <Select
            value={agentId || '_none'}
            onValueChange={(v) => {
              setAgentId(v === '_none' ? '' : v)
              setRepoId('')
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">
                <span className="text-muted-foreground">No agent</span>
              </SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Repository</Label>
          <Select
            value={repoId || '_none'}
            onValueChange={(v) => setRepoId(v === '_none' ? '' : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select repo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">
                <span className="text-muted-foreground">No repo</span>
              </SelectItem>
              {currentRepos.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.repo_url.replace(/^https?:\/\//, '').replace(/\.git$/, '')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {agentId && currentRepos.length === 0 && (
            <p className="text-xs text-muted-foreground">No repos linked to this agent</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="wo-branch">Branch (optional)</Label>
        <Input
          id="wo-branch"
          value={branchName}
          onChange={(e) => setBranchName(e.target.value)}
          placeholder="main"
          className="font-mono"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Work items</Label>
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add
          </Button>
        </div>
        {lines.length === 0 && (
          <p className="text-xs text-muted-foreground">Add items to define specific tasks.</p>
        )}
        <div className="space-y-3">
          {lines.map((line, idx) => (
            <div key={idx} className="rounded-md border border-border p-3 space-y-2 bg-muted/20">
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-1.5">
                  <Input
                    value={line.title}
                    onChange={(e) => updateLine(idx, 'title', e.target.value)}
                    placeholder="Title"
                    className="h-8 text-sm"
                  />
                  <Textarea
                    value={line.definition_of_done ?? ''}
                    onChange={(e) => updateLine(idx, 'definition_of_done', e.target.value)}
                    placeholder="Definition of done"
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 mt-0.5 text-muted-foreground hover:text-destructive"
                  onClick={() => removeLine(idx)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="wo-constraints">Constraints (JSON, optional)</Label>
        <Textarea
          id="wo-constraints"
          value={constraintsJson}
          onChange={(e) => setConstraintsJson(e.target.value)}
          placeholder={'{ "do_not_modify": [], "must_use": [] }'}
          rows={3}
          className="font-mono text-xs"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="wo-hints">Exploration hints (JSON, optional)</Label>
        <Textarea
          id="wo-hints"
          value={explorationHintsJson}
          onChange={(e) => setExplorationHintsJson(e.target.value)}
          placeholder={'{ "start_here": [], "reference": [] }'}
          rows={2}
          className="font-mono text-xs"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="wo-verification">Verification (JSON, optional)</Label>
        <Textarea
          id="wo-verification"
          value={verificationJson}
          onChange={(e) => setVerificationJson(e.target.value)}
          placeholder={'{ "test_command": "npm test" }'}
          rows={2}
          className="font-mono text-xs"
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save' : 'Create draft'}
        </Button>
        <Button type="button" variant="outline" asChild>
          <Link href={workOrder ? `/work-orders/${workOrder.id}` : '/work-orders'}>
            Cancel
          </Link>
        </Button>
      </div>
    </form>
  )
}
