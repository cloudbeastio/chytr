import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

export interface FailureReasonEntry {
  name: string
  failure_type: string
  value: number
}

interface FailureReasonsCardProps {
  entries: FailureReasonEntry[]
}

function formatFailureType(ft: string): string {
  if (ft === 'timeout') return 'Timeout'
  if (ft === 'permission_denied') return 'Permission denied'
  return ft ? ft.replace(/_/g, ' ') : 'Error'
}

export function FailureReasonsCard({ entries }: FailureReasonsCardProps) {
  if (!entries.length) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">Top failures by type</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Tool failures in range grouped by tool and failure type
        </p>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {entries.map(({ name, failure_type, value }) => (
            <li
              key={`${name}:${failure_type}`}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="truncate" title={name}>
                {name}
              </span>
              <span className="text-muted-foreground shrink-0">
                {formatFailureType(failure_type)} · {value}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
