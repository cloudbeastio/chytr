export type DashboardRange = 'day' | 'week' | 'month' | 'custom'

const MAX_RANGE_DAYS = 365

export interface DateBounds {
  start: Date
  end: Date
}

/**
 * Compute start/end dates for dashboard time range.
 * - day: today 00:00 to now
 * - week: 7 days ago to now
 * - month: 30 days ago to now
 * - custom: from/to (clamped to MAX_RANGE_DAYS)
 */
export function getBoundsFromRange(
  range: DashboardRange,
  from?: string,
  to?: string
): DateBounds {
  const end = new Date()
  let start: Date

  switch (range) {
    case 'day': {
      start = new Date(end)
      start.setHours(0, 0, 0, 0)
      break
    }
    case 'week': {
      start = new Date(end)
      start.setDate(start.getDate() - 7)
      break
    }
    case 'month': {
      start = new Date(end)
      start.setDate(start.getDate() - 30)
      break
    }
    case 'custom': {
      if (from && to) {
        start = new Date(from)
        const endParsed = new Date(to)
        if (!Number.isNaN(start.getTime()) && !Number.isNaN(endParsed.getTime())) {
          const days = (endParsed.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
          if (days > MAX_RANGE_DAYS) {
            start = new Date(endParsed)
            start.setDate(start.getDate() - MAX_RANGE_DAYS)
          }
          return { start, end: endParsed }
        }
      }
      start = new Date(end)
      start.setDate(start.getDate() - 7)
      break
    }
    default: {
      start = new Date(end)
      start.setDate(start.getDate() - 7)
    }
  }

  return { start, end }
}

export function formatRangeLabel(range: DashboardRange, from?: string, to?: string): string {
  if (range === 'custom' && from && to) {
    const a = new Date(from)
    const b = new Date(to)
    if (!Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime())) {
      return `${a.toLocaleDateString()} – ${b.toLocaleDateString()}`
    }
  }
  const labels: Record<Exclude<DashboardRange, 'custom'>, string> = {
    day: 'Today',
    week: 'Last 7 days',
    month: 'Last 30 days',
  }
  return (range === 'custom' ? 'Last 7 days' : labels[range]) ?? 'Last 7 days'
}
