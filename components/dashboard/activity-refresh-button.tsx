'use client'

import { useRouter } from 'next/navigation'
import { startTransition, useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

export function ActivityRefreshButton() {
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)

  function handleRefresh() {
    setRefreshing(true)
    startTransition(() => {
      router.refresh()
    })
    setTimeout(() => setRefreshing(false), 800)
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRefresh}
      disabled={refreshing}
      className="gap-1.5"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
      Refresh
    </Button>
  )
}
