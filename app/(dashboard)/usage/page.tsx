import { createSupabaseServerClient } from '@/lib/supabase'
import { loadLicenseFromDB } from '@/lib/license-server'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CheckCircle, XCircle } from 'lucide-react'

const ALL_KNOWN_FEATURES = [
  'logging',
  'dashboard',
  'work_orders',
  'agents',
  'knowledge',
  'scheduled_jobs',
  'approvals',
  'analytics',
  'multi_user',
] as const

async function fetchUsageData() {
  const supabase = await createSupabaseServerClient()
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const startStr = thirtyDaysAgo.toISOString()

  const [{ count: knowledgeCount }, license, costRes] = await Promise.all([
    supabase.from('knowledge').select('*', { count: 'exact', head: true }),
    loadLicenseFromDB(),
    supabase
      .from('work_orders')
      .select('total_cost')
      .gte('created_at', startStr),
  ])

  let costLast30Days = 0
  const costRows = (costRes.data ?? []) as Array<{ total_cost: number }>
  for (const row of costRows) {
    costLast30Days += Number(row.total_cost) || 0
  }

  return {
    knowledgeCount: knowledgeCount ?? 0,
    license,
    costLast30Days,
  }
}

export default async function UsagePage() {
  const { knowledgeCount, license, costLast30Days } = await fetchUsageData()

  const knowledgeLimit = license?.limits.knowledge_entries ?? 500
  const logRetentionDays = license?.limits.log_retention_days ?? 7
  const agentReposLimit = license?.limits.agent_repos ?? 1
  const usagePct = knowledgeLimit > 0 ? Math.min(100, (knowledgeCount / knowledgeLimit) * 100) : 0
  const enabledFeatures = new Set(license?.features ?? [])

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Usage</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          License limits and feature availability
        </p>
      </div>

      {/* Cost in range (last 30 days) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cost (last 30 days)</CardTitle>
          <CardDescription>
            Sum of work order cost in the last 30 days. Populated when agents report cost (e.g. via Cursor API).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">
            ${costLast30Days.toFixed(2)}
          </p>
        </CardContent>
      </Card>

      {/* Knowledge entries usage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Knowledge Entries</CardTitle>
          <CardDescription>
            Learnings extracted from agent work orders
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end justify-between">
            <span className="text-2xl font-bold">{knowledgeCount.toLocaleString()}</span>
            <span className="text-sm text-muted-foreground">
              of {knowledgeLimit.toLocaleString()} entries
            </span>
          </div>
          <Progress value={usagePct} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {usagePct.toFixed(1)}% used
            {usagePct >= 90 && (
              <span className="text-yellow-400 ml-2">
                Near limit — upgrade at chytr.ai
              </span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Limits summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Limits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
            <div className="text-muted-foreground">Tier</div>
            <div>
              <Badge variant={license?.tier === 'free' ? 'secondary' : 'default'} className="capitalize">
                {license?.tier ?? 'free'}
              </Badge>
            </div>

            <div className="text-muted-foreground">Knowledge entries</div>
            <div>{knowledgeLimit.toLocaleString()}</div>

            <div className="text-muted-foreground">Log retention</div>
            <div>
              {logRetentionDays} days
              <p className="text-xs text-muted-foreground mt-0.5">
                Logs older than {logRetentionDays} days are purged.
              </p>
            </div>

            <div className="text-muted-foreground">Agent repos</div>
            <div>{agentReposLimit}</div>
          </div>
        </CardContent>
      </Card>

      {/* Features table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Features</CardTitle>
          <CardDescription>Available capabilities for your license tier</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Feature</TableHead>
                <TableHead className="w-28 text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ALL_KNOWN_FEATURES.map((feature) => {
                const enabled = enabledFeatures.has(feature)
                return (
                  <TableRow key={feature}>
                    <TableCell className="capitalize text-sm">
                      {feature.replace(/_/g, ' ')}
                    </TableCell>
                    <TableCell className="text-right">
                      {enabled ? (
                        <span className="flex items-center justify-end gap-1 text-green-400 text-xs">
                          <CheckCircle className="h-3.5 w-3.5" />
                          Enabled
                        </span>
                      ) : (
                        <span className="flex items-center justify-end gap-1 text-muted-foreground text-xs">
                          <XCircle className="h-3.5 w-3.5" />
                          Unavailable
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
