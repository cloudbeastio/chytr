import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ContractStatRow } from '@/lib/database.types'

interface ContractStatsProps {
  stats: ContractStatRow | null
  budgetLimit: number | null
}

function formatCost(n: number): string {
  if (n === 0) return '$0.00'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(n)
}

export function ContractStats({ stats, budgetLimit }: ContractStatsProps) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">—</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">—</p>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const totalCost = Number(stats.total_cost) ?? 0
  const budgetUtil = budgetLimit != null && budgetLimit > 0
    ? Math.min(100, (totalCost / budgetLimit) * 100)
    : null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground">Work orders</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-semibold tabular-nums">{stats.total_work_orders}</p>
          <p className="text-xs text-muted-foreground">
            {stats.completed} completed · {stats.failed} failed
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground">Total cost</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-semibold tabular-nums">{formatCost(totalCost)}</p>
          {budgetLimit != null && budgetLimit > 0 && (
            <p className="text-xs text-muted-foreground">
              of {formatCost(budgetLimit)} budget
            </p>
          )}
        </CardContent>
      </Card>

      {budgetUtil != null && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-muted-foreground">Budget used</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold tabular-nums">{budgetUtil.toFixed(0)}%</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="text-xs font-medium text-muted-foreground">Running</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-semibold tabular-nums">{stats.running}</p>
        </CardContent>
      </Card>
    </div>
  )
}
