'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ApprovalCard } from '@/components/approvals/approval-card'
import { Card, CardContent } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { ApprovalWithMeta } from '@/app/(dashboard)/approvals/page'
import type { ApprovalStatus } from '@/lib/database.types'

const HISTORY_BADGE: Record<
  Exclude<ApprovalStatus, 'pending'>,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  resolved: { label: 'Resolved', variant: 'outline' },
  expired: { label: 'Expired', variant: 'secondary' },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface ApprovalsContentProps {
  pending: ApprovalWithMeta[]
  history: ApprovalWithMeta[]
}

export function ApprovalsContent({ pending, history }: ApprovalsContentProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  function refresh() {
    startTransition(() => router.refresh())
  }

  return (
    <Tabs defaultValue="pending">
      <TabsList>
        <TabsTrigger value="pending">
          Pending
          {pending.length > 0 && (
            <Badge variant="default" className="ml-2 text-[10px] px-1.5 py-0 leading-tight">
              {pending.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>

      <TabsContent value="pending" className="mt-4">
        {pending.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No pending approvals. You're all caught up.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {pending.map((approval) => (
              <ApprovalCard key={approval.id} approval={approval} onResolved={refresh} />
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="history" className="mt-4">
        {history.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No resolved approvals yet.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Question</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Decision</TableHead>
                    <TableHead>Decided By</TableHead>
                    <TableHead>Decided At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((a) => {
                    const badgeCfg =
                      HISTORY_BADGE[a.status as Exclude<ApprovalStatus, 'pending'>] ??
                      HISTORY_BADGE.expired
                    return (
                      <TableRow key={a.id}>
                        <TableCell className="max-w-xs">
                          <p className="text-sm truncate" title={a.question}>
                            {a.question}
                          </p>
                          <a
                            href={`/work-orders/${a.work_order_id}`}
                            className="text-xs text-muted-foreground hover:underline"
                          >
                            {a.work_order_id.slice(0, 8)}…
                          </a>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {a.agentName ?? '—'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={badgeCfg.variant}>{badgeCfg.label}</Badge>
                            {a.decision && (
                              <span className="text-xs text-muted-foreground">{a.decision}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {a.decided_by ?? '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {a.decided_at ? formatDate(a.decided_at) : '—'}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  )
}
