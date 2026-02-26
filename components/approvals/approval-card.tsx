'use client'

import { useState } from 'react'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, ChevronUp, Bot, Clock, X } from 'lucide-react'
import type { ApprovalWithMeta } from '@/app/(dashboard)/approvals/page'

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const m = Math.floor(seconds / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function expiresIn(iso: string | null): string | null {
  if (!iso) return null
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function parseOptions(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((o) => typeof o === 'string') as string[]
  }
  return []
}

interface ApprovalCardProps {
  approval: ApprovalWithMeta
  onResolved: () => void
}

export function ApprovalCard({ approval, onResolved }: ApprovalCardProps) {
  const [contextOpen, setContextOpen] = useState(false)
  const [resolving, setResolving] = useState<string | null>(null)

  const options = parseOptions(approval.options)
  const hasContext =
    approval.context && typeof approval.context === 'object' && Object.keys(approval.context).length > 0
  const expiry = expiresIn(approval.expires_at)

  async function resolve(decision: string) {
    setResolving(decision)
    try {
      await fetch(`/api/approvals/${approval.id}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, decided_by: 'dashboard' }),
      })
      onResolved()
    } finally {
      setResolving(null)
    }
  }

  const isLoading = resolving !== null

  return (
    <Card className="border-border">
      <CardContent className="pt-4 pb-3 space-y-3">
        {/* Meta row */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          {approval.agentName && (
            <span className="flex items-center gap-1">
              <Bot className="h-3 w-3" />
              {approval.agentName}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {timeAgo(approval.created_at)}
          </span>
          <a
            href={`/work-orders/${approval.work_order_id}`}
            className="hover:underline underline-offset-2"
          >
            Work order {approval.work_order_id.slice(0, 8)}…
          </a>
          {expiry && (
            <Badge
              variant={expiry === 'Expired' ? 'destructive' : 'outline'}
              className="text-[10px] px-1.5 py-0"
            >
              {expiry === 'Expired' ? 'Expired' : `Expires in ${expiry}`}
            </Badge>
          )}
        </div>

        {/* Question */}
        <p className="text-sm font-medium leading-snug">{approval.question}</p>

        {/* Context (collapsible) */}
        {hasContext && (
          <div>
            <button
              onClick={() => setContextOpen((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {contextOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              {contextOpen ? 'Hide context' : 'Show context'}
            </button>
            {contextOpen && (
              <pre className="mt-2 text-xs text-muted-foreground bg-muted rounded-md p-3 overflow-x-auto whitespace-pre-wrap break-words">
                {JSON.stringify(approval.context, null, 2)}
              </pre>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap items-center gap-2 pt-0 pb-4">
        {options.length > 0 ? (
          options.map((opt) => (
            <Button
              key={opt}
              size="sm"
              variant="outline"
              onClick={() => resolve(opt)}
              disabled={isLoading}
              className="h-7 text-xs"
            >
              {resolving === opt ? 'Saving…' : opt}
            </Button>
          ))
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => resolve('approved')}
            disabled={isLoading}
            className="h-7 text-xs"
          >
            {resolving === 'approved' ? 'Saving…' : 'Approve'}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => resolve('rejected')}
          disabled={isLoading}
          className="h-7 text-xs text-muted-foreground hover:text-destructive"
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Reject
        </Button>
      </CardFooter>
    </Card>
  )
}
