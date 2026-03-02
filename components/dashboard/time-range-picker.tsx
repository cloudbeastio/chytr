'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CalendarIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DashboardRange } from '@/lib/dashboard-utils'

const PRESETS: { value: DashboardRange; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
]

function toYYYYMMDD(d: Date): string {
  return d.toISOString().slice(0, 10)
}

interface TimeRangePickerProps {
  range: DashboardRange
  from?: string
  to?: string
  className?: string
}

export function TimeRangePicker({ range, from, to, className }: TimeRangePickerProps) {
  const router = useRouter()
  const pathname = usePathname()

  function setRange(newRange: DashboardRange, customFrom?: string, customTo?: string) {
    const params = new URLSearchParams()
    params.set('range', newRange)
    if (newRange === 'custom' && customFrom && customTo) {
      params.set('from', customFrom)
      params.set('to', customTo)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  const handlePresetClick = (value: DashboardRange) => {
    setRange(value)
  }

  const handleCustomSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fromInput = form.elements.namedItem('from') as HTMLInputElement
    const toInput = form.elements.namedItem('to') as HTMLInputElement
    const fromVal = fromInput?.value
    const toVal = toInput?.value
    if (fromVal && toVal && new Date(fromVal) <= new Date(toVal)) {
      setRange('custom', fromVal, toVal)
    }
  }

  const endDefault = to ?? toYYYYMMDD(new Date())
  const startDefault = from ?? toYYYYMMDD(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))

  return (
    <div className={cn('flex items-center gap-1', className)}>
      {PRESETS.map(({ value, label }) => (
        <Button
          key={value}
          variant={range === value ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => handlePresetClick(value)}
        >
          {label}
        </Button>
      ))}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={range === 'custom' ? 'secondary' : 'ghost'}
            size="sm"
          >
            <CalendarIcon className="h-4 w-4 mr-1" />
            Custom
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="end">
          <form onSubmit={handleCustomSubmit} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="from">From</Label>
              <Input
                id="from"
                name="from"
                type="date"
                defaultValue={startDefault}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
                name="to"
                type="date"
                defaultValue={endDefault}
                required
              />
            </div>
            <Button type="submit" size="sm" className="w-full">
              Apply
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  )
}
