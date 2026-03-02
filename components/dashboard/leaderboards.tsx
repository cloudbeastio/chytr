import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Crown, Medal, Award } from 'lucide-react'

export interface LeaderEntry {
  name: string
  value: number
  subtitle?: string
}

const PODIUM_ICONS = [
  { Icon: Crown, color: 'text-yellow-400' },
  { Icon: Medal, color: 'text-zinc-300' },
  { Icon: Award, color: 'text-amber-600' },
]

function LeaderList({ title, entries, unit }: { title: string; entries: LeaderEntry[]; unit: string }) {
  if (!entries.length) {
    return (
      <div>
        <h3 className="text-sm font-medium mb-3">{title}</h3>
        <p className="text-xs text-muted-foreground text-center py-3">No data yet</p>
      </div>
    )
  }

  const max = entries[0]?.value ?? 1

  return (
    <div>
      <h3 className="text-sm font-medium mb-3">{title}</h3>
      <div className="space-y-2">
        {entries.map((entry, i) => {
          const podium = PODIUM_ICONS[i]
          const pct = max > 0 ? (entry.value / max) * 100 : 0
          return (
            <div key={entry.name} className="space-y-1">
              <div className="flex items-center gap-2">
                {podium ? (
                  <podium.Icon className={`h-3.5 w-3.5 shrink-0 ${podium.color}`} />
                ) : (
                  <span className="w-3.5 text-center text-[10px] text-muted-foreground shrink-0">{i + 1}</span>
                )}
                <span className="text-xs truncate flex-1">{entry.name}</span>
                <span className="text-xs tabular-nums text-muted-foreground shrink-0">
                  {entry.value.toLocaleString()} {unit}
                </span>
              </div>
              <div className="h-1 rounded-full bg-muted overflow-hidden ml-5">
                <div
                  className="h-full rounded-full bg-primary/60 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface LeaderboardsProps {
  topAgents: LeaderEntry[]
  topTools: LeaderEntry[]
  topSkills: LeaderEntry[]
}

export function Leaderboards({ topAgents, topTools, topSkills }: LeaderboardsProps) {
  const empty = !topAgents.length && !topTools.length && !topSkills.length

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Leaderboards</CardTitle>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No activity data yet
          </p>
        ) : (
          <div className="space-y-6">
            <LeaderList title="Top Agents" entries={topAgents} unit="runs" />
            <LeaderList title="Top Tools" entries={topTools} unit="calls" />
            <LeaderList title="Top Skills" entries={topSkills} unit="loads" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
