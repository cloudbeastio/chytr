'use client'

import { useState, useCallback, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Search, Link as LinkIcon, X } from 'lucide-react'
import type { Knowledge } from '@/lib/database.types'

interface KnowledgeBrowserProps {
  initialEntries: Knowledge[]
  agentTypes: string[]
  totalCount: number
  knowledgeLimit: number
}

const PAGE_SIZE = 20

function formatTimeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function KnowledgeCard({ entry }: { entry: Knowledge }) {
  return (
    <div className="border border-border rounded-lg p-4 space-y-2 hover:border-border/80 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm leading-relaxed flex-1">{entry.learning}</p>
        <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">
          ×{entry.frequency}
        </Badge>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
        {entry.agent_type && (
          <span className="bg-muted/40 rounded px-1.5 py-0.5">{entry.agent_type}</span>
        )}
        <span>Seen {formatTimeAgo(entry.last_seen_at)}</span>
        {entry.work_order_id && (
          <a
            href={`/work-orders/${entry.work_order_id}`}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <LinkIcon className="h-2.5 w-2.5" />
            <span>Work order</span>
          </a>
        )}
      </div>
    </div>
  )
}

function KnowledgeCardSkeleton() {
  return (
    <div className="border border-border rounded-lg p-4 space-y-2">
      <div className="flex justify-between gap-3">
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
        <Skeleton className="h-5 w-8 shrink-0" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  )
}

export function KnowledgeBrowser({
  initialEntries,
  agentTypes,
  totalCount,
  knowledgeLimit,
}: KnowledgeBrowserProps) {
  const [query, setQuery] = useState('')
  const [agentTypeFilter, setAgentTypeFilter] = useState<string>('all')
  const [entries, setEntries] = useState<Knowledge[]>(initialEntries)
  const [searching, startSearch] = useTransition()
  const [page, setPage] = useState(0)
  const [searchMode, setSearchMode] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)

  const usagePct = knowledgeLimit > 0 ? Math.min(100, (totalCount / knowledgeLimit) * 100) : 0

  const doSearch = useCallback(
    async (q: string, type: string) => {
      setSearchError(null)
      if (!q.trim()) {
        setSearchMode(false)
        setEntries(initialEntries)
        return
      }
      setSearchMode(true)
      startSearch(async () => {
        try {
          const params = new URLSearchParams({ q: q.trim() })
          if (type !== 'all') params.set('agent_type', type)
          const res = await fetch(`/api/knowledge/search?${params}`)
          if (!res.ok) throw new Error('Search failed')
          const data = (await res.json()) as { results: Knowledge[] }
          setEntries(data.results ?? [])
          setPage(0)
        } catch {
          setSearchError('Search failed. Try again.')
        }
      })
    },
    [initialEntries]
  )

  function handleQueryChange(val: string) {
    setQuery(val)
    if (!val.trim()) {
      setSearchMode(false)
      setEntries(initialEntries)
    }
  }

  function clearSearch() {
    setQuery('')
    setSearchMode(false)
    setEntries(initialEntries)
    setPage(0)
  }

  const filtered = agentTypeFilter === 'all' || searchMode
    ? entries
    : entries.filter((e) => e.agent_type === agentTypeFilter)

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-muted-foreground">
          <span className="text-foreground font-medium">{totalCount.toLocaleString()}</span>
          {knowledgeLimit > 0 && (
            <span className="text-muted-foreground"> / {knowledgeLimit.toLocaleString()} entries</span>
          )}
        </span>
        {knowledgeLimit > 0 && (
          <div className="flex items-center gap-2 flex-1 max-w-xs">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${usagePct}%` }}
              />
            </div>
            <span className="text-[11px] text-muted-foreground">{usagePct.toFixed(0)}%</span>
          </div>
        )}
      </div>

      {/* Search + filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Semantic search…"
            className="pl-8 pr-8 h-8 text-sm"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doSearch(query, agentTypeFilter) }}
          />
          {query && (
            <button
              onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => doSearch(query, agentTypeFilter)}
          disabled={searching || !query.trim()}
          className="h-8"
        >
          Search
        </Button>

        <Select value={agentTypeFilter} onValueChange={(v) => {
          setAgentTypeFilter(v)
          if (searchMode) doSearch(query, v)
        }}>
          <SelectTrigger className="w-36 h-8 text-xs">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {agentTypes.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {searchError && <p className="text-xs text-red-400">{searchError}</p>}

      {/* Entries */}
      {searching ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <KnowledgeCardSkeleton key={i} />
          ))}
        </div>
      ) : paginated.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-lg">
          <p className="text-sm text-muted-foreground">
            {searchMode ? 'No results found.' : 'No knowledge entries yet.'}
          </p>
          {searchMode && (
            <button
              onClick={clearSearch}
              className="text-xs text-muted-foreground underline mt-1 hover:text-foreground"
            >
              Clear search
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {paginated.map((entry) => (
            <KnowledgeCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of{' '}
            {filtered.length}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
