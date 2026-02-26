import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { SidebarNav } from '@/components/dashboard/sidebar-nav'
import { UserMenu } from '@/components/dashboard/user-menu'
import { loadLicenseFromDB } from '@/lib/license'
import { createSupabaseServerClient } from '@/lib/supabase'
import { Activity } from 'lucide-react'

const TIER_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> =
  {
    free: { label: 'Free', variant: 'secondary' },
    pro: { label: 'Pro', variant: 'default' },
    team: { label: 'Team', variant: 'default' },
  }

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const license = await loadLicenseFromDB()
  const tier = license?.tier ?? 'free'
  const tierBadge = TIER_BADGE[tier] ?? TIER_BADGE.free

  // Get authenticated user (null in dev mode — UserMenu handles it)
  let userEmail: string | null = null
  let userName: string | null = null
  let userAvatar: string | null = null

  if (process.env.CHYTR_DEV_MODE !== 'true') {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    userEmail = user?.email ?? null
    userName = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? null
    userAvatar = user?.user_metadata?.avatar_url ?? null
  } else {
    userEmail = 'dev@localhost'
    userName = 'Dev Mode'
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="flex flex-col w-60 shrink-0 border-r border-border bg-background">
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 h-14 shrink-0">
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary">
            <Activity className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold tracking-tight text-foreground">chytr</span>
          <Badge variant={tierBadge.variant} className="ml-auto text-[10px] px-1.5 py-0">
            {tierBadge.label}
          </Badge>
        </div>

        <Separator />

        <SidebarNav />

        <Separator />

        {/* Footer */}
        <div className="px-4 py-3 shrink-0">
          <p className="text-[11px] text-muted-foreground leading-snug">
            Self-hosted instance
            <br />
            <a
              href="https://www.chytr.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground transition-colors"
            >
              chytr.ai
            </a>
          </p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Top header */}
        <header className="flex items-center h-14 px-6 shrink-0 border-b border-border">
          <div className="flex-1" />
          <div className="flex items-center gap-3">
            <Badge variant={tierBadge.variant} className="text-[10px] px-1.5 py-0">
              {tierBadge.label}
            </Badge>
            <UserMenu email={userEmail} name={userName} avatarUrl={userAvatar} />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
