import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowDownRight, ArrowUpRight, Sigma } from 'lucide-react'

function formatTokens(n: number): string {
  if (n === 0) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function formatCost(cost: number): string {
  if (cost === 0) return '$0.00'
  if (cost < 0.01) return `<$0.01`
  return `$${cost.toFixed(2)}`
}

interface TokenUsageProps {
  tokensIn: number
  tokensOut: number
  totalCost: number
}

export function TokenUsage({ tokensIn, tokensOut, totalCost }: TokenUsageProps) {
  const total = tokensIn + tokensOut

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Token Usage</CardTitle>
          {totalCost > 0 && (
            <span className="text-xs text-muted-foreground">{formatCost(totalCost)} total cost</span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ArrowDownRight className="h-3.5 w-3.5" />
              <span className="text-xs">Input</span>
            </div>
            <p className="text-lg font-semibold tabular-nums">{formatTokens(tokensIn)}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span className="text-xs">Output</span>
            </div>
            <p className="text-lg font-semibold tabular-nums">{formatTokens(tokensOut)}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Sigma className="h-3.5 w-3.5" />
              <span className="text-xs">Total</span>
            </div>
            <p className="text-lg font-semibold tabular-nums">{formatTokens(total)}</p>
          </div>
        </div>

        {total > 0 && (
          <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden flex">
            <div
              className="h-full bg-blue-500/70 transition-all"
              style={{ width: `${(tokensIn / total) * 100}%` }}
            />
            <div
              className="h-full bg-emerald-500/70 transition-all"
              style={{ width: `${(tokensOut / total) * 100}%` }}
            />
          </div>
        )}
        {total > 0 && (
          <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500/70 inline-block" />
              Input {((tokensIn / total) * 100).toFixed(0)}%
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500/70 inline-block" />
              Output {((tokensOut / total) * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
