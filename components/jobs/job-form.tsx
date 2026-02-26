'use client'

import { useState, useEffect } from 'react'
import cronstrue from 'cronstrue'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { Separator } from '@/components/ui/separator'
import { Plus, Trash2 } from 'lucide-react'
import type { ScheduledJob, Agent, AgentRepo } from '@/lib/database.types'

interface WorkLine {
  title: string
  definition_of_done: string
}

interface WorkOrderTemplate {
  objective: string
  lines: WorkLine[]
  constraints: string
}

const EMPTY_TEMPLATE: WorkOrderTemplate = {
  objective: '',
  lines: [],
  constraints: '',
}

function humanCron(expr: string): string {
  if (!expr.trim()) return ''
  try {
    return cronstrue.toString(expr, { use24HourTimeFormat: true })
  } catch {
    return 'Invalid expression'
  }
}

function parseTemplate(raw: unknown): WorkOrderTemplate {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_TEMPLATE }
  const t = raw as Record<string, unknown>
  return {
    objective: typeof t.objective === 'string' ? t.objective : '',
    lines: Array.isArray(t.lines)
      ? (t.lines as WorkLine[]).map((l) => ({
          title: typeof l.title === 'string' ? l.title : '',
          definition_of_done:
            typeof l.definition_of_done === 'string' ? l.definition_of_done : '',
        }))
      : [],
    constraints:
      t.constraints && typeof t.constraints === 'object'
        ? JSON.stringify(t.constraints, null, 2)
        : typeof t.constraints === 'string'
          ? t.constraints
          : '',
  }
}

interface JobFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  agents: Pick<Agent, 'id' | 'name'>[]
  repos: Pick<AgentRepo, 'id' | 'agent_id' | 'repo_url'>[]
  job?: ScheduledJob
  onSuccess: () => void
}

export function JobForm({ open, onOpenChange, agents, repos, job, onSuccess }: JobFormProps) {
  const isEdit = !!job
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [cron, setCron] = useState('')
  const [agentId, setAgentId] = useState('')
  const [repoId, setRepoId] = useState('')
  const [template, setTemplate] = useState<WorkOrderTemplate>({ ...EMPTY_TEMPLATE })

  useEffect(() => {
    if (open) {
      if (job) {
        setName(job.name)
        setCron(job.cron_expression)
        setAgentId(job.agent_id ?? '')
        setRepoId(job.repo_id ?? '')
        setTemplate(parseTemplate(job.work_order_template))
      } else {
        setName('')
        setCron('')
        setAgentId('')
        setRepoId('')
        setTemplate({ ...EMPTY_TEMPLATE })
      }
      setError(null)
    }
  }, [open, job])

  const filteredRepos =
    agentId ? repos.filter((r) => r.agent_id === agentId) : repos

  function addLine() {
    setTemplate((t) => ({ ...t, lines: [...t.lines, { title: '', definition_of_done: '' }] }))
  }

  function removeLine(idx: number) {
    setTemplate((t) => ({ ...t, lines: t.lines.filter((_, i) => i !== idx) }))
  }

  function updateLine(idx: number, field: keyof WorkLine, value: string) {
    setTemplate((t) => ({
      ...t,
      lines: t.lines.map((l, i) => (i === idx ? { ...l, [field]: value } : l)),
    }))
  }

  async function handleSave() {
    setError(null)
    if (!name.trim()) { setError('Name is required'); return }
    if (!cron.trim()) { setError('Cron expression is required'); return }

    let constraintsJson: unknown = null
    if (template.constraints.trim()) {
      try {
        constraintsJson = JSON.parse(template.constraints)
      } catch {
        setError('Constraints must be valid JSON')
        return
      }
    }

    const payload = {
      name: name.trim(),
      cron_expression: cron.trim(),
      agent_id: agentId || null,
      repo_id: repoId || null,
      work_order_template: {
        objective: template.objective,
        lines: template.lines.filter((l) => l.title.trim()),
        constraints: constraintsJson,
      },
    }

    setSaving(true)
    try {
      const res = isEdit
        ? await fetch(`/api/jobs/${job!.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? 'Save failed')
        return
      }

      onSuccess()
      onOpenChange(false)
    } catch (err) {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  const cronHuman = humanCron(cron)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Job' : 'New Scheduled Job'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="job-name">Name</Label>
            <Input
              id="job-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Daily code review"
            />
          </div>

          {/* Cron */}
          <div className="space-y-1.5">
            <Label htmlFor="job-cron">Cron Expression</Label>
            <Input
              id="job-cron"
              value={cron}
              onChange={(e) => setCron(e.target.value)}
              placeholder="0 9 * * 1-5"
              className="font-mono"
            />
            {cronHuman && (
              <p
                className={`text-xs ${cronHuman === 'Invalid expression' ? 'text-destructive' : 'text-muted-foreground'}`}
              >
                {cronHuman}
              </p>
            )}
          </div>

          {/* Agent */}
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
                <SelectValue placeholder="Select agent…" />
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

          {/* Repo */}
          <div className="space-y-1.5">
            <Label>Repository</Label>
            <Select
              value={repoId || '_none'}
              onValueChange={(v) => setRepoId(v === '_none' ? '' : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select repo…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">
                  <span className="text-muted-foreground">No repo</span>
                </SelectItem>
                {filteredRepos.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.repo_url.replace(/^https?:\/\//, '')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {agentId && filteredRepos.length === 0 && (
              <p className="text-xs text-muted-foreground">No repos linked to this agent</p>
            )}
          </div>

          <Separator />

          {/* Work Order Template */}
          <div className="space-y-4">
            <p className="text-sm font-medium">Work Order Template</p>

            <div className="space-y-1.5">
              <Label htmlFor="job-objective">Objective</Label>
              <Textarea
                id="job-objective"
                value={template.objective}
                onChange={(e) => setTemplate((t) => ({ ...t, objective: e.target.value }))}
                placeholder="Describe what this job should accomplish…"
                rows={3}
              />
            </div>

            {/* Lines builder */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Work Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add Item
                </Button>
              </div>
              {template.lines.length === 0 && (
                <p className="text-xs text-muted-foreground">No work items. Add items to define specific tasks.</p>
              )}
              <div className="space-y-3">
                {template.lines.map((line, idx) => (
                  <div key={idx} className="rounded-md border p-3 space-y-2 bg-muted/30">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 space-y-1.5">
                        <Input
                          value={line.title}
                          onChange={(e) => updateLine(idx, 'title', e.target.value)}
                          placeholder="Title"
                          className="h-8 text-sm"
                        />
                        <Textarea
                          value={line.definition_of_done}
                          onChange={(e) => updateLine(idx, 'definition_of_done', e.target.value)}
                          placeholder="Definition of done…"
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

            {/* Constraints JSON */}
            <div className="space-y-1.5">
              <Label htmlFor="job-constraints">Constraints (JSON)</Label>
              <Textarea
                id="job-constraints"
                value={template.constraints}
                onChange={(e) => setTemplate((t) => ({ ...t, constraints: e.target.value }))}
                placeholder={'{\n  "max_tokens": 50000\n}'}
                rows={4}
                className="font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Job'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
