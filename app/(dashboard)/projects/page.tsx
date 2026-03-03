import { createSupabaseServerClient } from '@/lib/supabase'
import { Suspense } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ProjectFilters } from '@/components/projects/project-filters'
import { FileText, Plus } from 'lucide-react'
import type { Project, ProjectStatRow, ProjectStatus, ProjectType } from '@/lib/database.types'

const STATUS_LABELS: Record<ProjectStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  paused: 'Paused',
  closed: 'Closed',
}

const TYPE_LABELS: Record<ProjectType, string> = {
  one_off: 'One-off',
  master: 'Master',
  retainer: 'Retainer',
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

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

type ProjectWithStats = Project & { stats: ProjectStatRow | null }

interface PageProps {
  searchParams: Promise<{ status?: string; type?: string }>
}

async function ProjectsTable({
  status,
  type,
}: {
  status: string | undefined
  type: string | undefined
}) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive text-center">
        Sign in to view projects
      </div>
    )
  }

  let query = supabase
    .from('projects')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (type) query = query.eq('type', type)

  const { data: projectsData, error } = await query

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive text-center">
        Failed to load projects: {error.message}
      </div>
    )
  }

  const list = (projectsData ?? []) as Project[]
  const ids = list.map((c) => c.id)

  if (ids.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 gap-3">
        <FileText className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">
          {status || type ? 'No projects match these filters' : 'No projects yet'}
        </p>
        {(status || type) && (
          <Link
            href="/projects"
            className="text-xs text-primary hover:underline underline-offset-2"
          >
            Clear filters
          </Link>
        )}
        <Button asChild size="sm">
          <Link href="/projects/new">New project</Link>
        </Button>
      </div>
    )
  }

    const { data: statsRows } = await supabase
      .from('project_stats')
      .select('*')
      .in('project_id', ids)

    const statsByProjectId = ((statsRows ?? []) as ProjectStatRow[]).reduce<Record<string, ProjectStatRow>>(
      (acc, row) => {
        acc[row.project_id] = row
        return acc
      },
      {}
    )

  const rows: ProjectWithStats[] = list.map((c) => ({
    ...c,
    stats: statsByProjectId[c.id] ?? null,
  }))

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent border-border">
            <TableHead className="text-xs font-medium">Name</TableHead>
            <TableHead className="text-xs font-medium w-28">Account</TableHead>
            <TableHead className="text-xs font-medium w-24">Type</TableHead>
            <TableHead className="text-xs font-medium w-24">Status</TableHead>
            <TableHead className="text-xs font-medium w-20 text-right">WOs</TableHead>
            <TableHead className="text-xs font-medium w-24 text-right">Spend</TableHead>
            <TableHead className="text-xs font-medium w-24 text-right">Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((c) => (
            <TableRow
              key={c.id}
              className="cursor-pointer hover:bg-accent/30 border-border"
            >
              <TableCell>
                <Link href={`/projects/${c.id}`} className="block">
                  <span className="text-sm font-medium truncate block">
                    {c.name}
                    {c.is_default && (
                      <Badge variant="secondary" className="ml-2 text-[10px]">Default</Badge>
                    )}
                  </span>
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/projects/${c.id}`} className="block">
                  <span className="text-sm text-muted-foreground truncate block max-w-[140px]">
                    {c.account_name ?? '—'}
                  </span>
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/projects/${c.id}`} className="block">
                  <span className="text-xs text-muted-foreground">{TYPE_LABELS[c.type]}</span>
                </Link>
              </TableCell>
              <TableCell>
                <Link href={`/projects/${c.id}`} className="block">
                  <Badge variant="outline" className="text-[11px] px-1.5 py-0">
                    {STATUS_LABELS[c.status]}
                  </Badge>
                </Link>
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/projects/${c.id}`} className="block">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {c.stats?.total_chyts ?? 0}
                  </span>
                </Link>
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/projects/${c.id}`} className="block">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatCost(c.stats?.total_cost ?? 0)}
                  </span>
                </Link>
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/projects/${c.id}`} className="block">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatTimeAgo(new Date(c.created_at))}
                  </span>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

export default async function ProjectsPage({ searchParams }: PageProps) {
  const { status, type } = await searchParams

  return (
    <div className="space-y-5 max-w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Agreements and scope for chyts</p>
        </div>
        <div className="flex items-center gap-3">
          <Suspense fallback={null}>
            <ProjectFilters />
          </Suspense>
          <Button asChild size="sm">
            <Link href="/projects/new">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              New project
            </Link>
          </Button>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="rounded-lg border border-border h-64 animate-pulse bg-muted/20" />
        }
      >
        <ProjectsTable status={status} type={type} />
      </Suspense>
    </div>
  )
}
