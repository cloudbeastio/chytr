'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ClipboardList,
  Bot,
  Calendar,
  CheckCircle,
  Brain,
  Settings,
  Lock,
  BarChart2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  proGated?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/work-orders', label: 'Work Orders', icon: ClipboardList },
  { href: '/agents', label: 'Agents', icon: Bot },
  { href: '/jobs', label: 'Jobs', icon: Calendar, proGated: true },
  { href: '/approvals', label: 'Approvals', icon: CheckCircle, proGated: true },
  { href: '/knowledge', label: 'Knowledge', icon: Brain },
  { href: '/usage', label: 'Usage', icon: BarChart2 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function SidebarNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon, proGated }) => {
        const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              isActive
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{label}</span>
            {proGated && (
              <span className="flex items-center gap-1">
                <Lock className="h-3 w-3 opacity-50" />
                <Badge variant="outline" className="text-[10px] px-1 py-0 leading-tight">
                  PRO
                </Badge>
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
