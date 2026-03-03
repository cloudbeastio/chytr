'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Pencil, Play } from 'lucide-react'

interface ChytActionsProps {
  workOrderId: string
  status: string
}

export function ChytActions({ workOrderId, status }: ChytActionsProps) {
  const router = useRouter()
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isDraft = status === 'draft'

  async function handleApprove() {
    setError(null)
    setApproving(true)
    try {
      const res = await fetch(`/api/chyts/${workOrderId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError((data as { error?: string }).error ?? 'Approve failed')
        return
      }
      router.refresh()
    } catch {
      setError('Network error')
    } finally {
      setApproving(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link href={`/chyts/${workOrderId}/edit`}>
          <Pencil className="h-3.5 w-3.5 mr-1.5" />
          Edit
        </Link>
      </Button>
      {isDraft && (
        <Button size="sm" onClick={handleApprove} disabled={approving}>
          <Play className="h-3.5 w-3.5 mr-1.5" />
          {approving ? 'Launching…' : 'Approve & launch'}
        </Button>
      )}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  )
}
