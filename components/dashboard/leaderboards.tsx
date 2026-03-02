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
                <span className="text-xs truncate flex-1" title={entry.name}>{entry.name}</span>
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
  topRepos: LeaderEntry[]
  topAgentActions: LeaderEntry[]
  topTools: LeaderEntry[]
  topSkills: LeaderEntry[]
  topCommands: LeaderEntry[]
  topModels?: LeaderEntry[]
  topCostRepos?: LeaderEntry[]
}

export function Leaderboards({
  topRepos,
  topAgentActions,
  topTools,
  topSkills,
  topCommands,
  topModels = [],
  topCostRepos = [],
}: LeaderboardsProps) {
  const empty =
    !topRepos.length &&
    !topAgentActions.length &&
    !topTools.length &&
    !topSkills.length &&
    !topCommands.length &&
    !topModels.length &&
    !topCostRepos.length

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Top 5 leaderboards</CardTitle>
      </CardHeader>
      <CardContent>
        {empty ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No activity data yet
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 xl:grid-cols-6 gap-6">
            {topModels.length > 0 && (
              <LeaderList title="Activity by model" entries={topModels.slice(0, 5)} unit="events" />
            )}
            {topCostRepos.length > 0 && (
              <LeaderList title="Cost by repo" entries={topCostRepos} unit="$" />
            )}
            <LeaderList title="Top 5 repos (by logs)" entries={topRepos} unit="logs" />
            <LeaderList title="Top 5 agent actions" entries={topAgentActions} unit="events" />
            <LeaderList title="Top 5 tool commands" entries={topTools} unit="calls" />
            <LeaderList title="Top 5 skills" entries={topSkills} unit="loads" />
            <LeaderList title="Top 5 commands" entries={topCommands} unit="runs" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
