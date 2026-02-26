'use client'

import { isFeatureEnabled } from '@/lib/license'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface FeatureGateProps {
  feature: string
  requiredTier?: 'pro' | 'team'
  children: React.ReactNode
}

export function FeatureGate({ feature, requiredTier = 'pro', children }: FeatureGateProps) {
  const enabled = isFeatureEnabled(feature)

  if (enabled) return <>{children}</>

  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
        <div className="p-3 bg-muted rounded-full">
          <Lock className="h-6 w-6 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium">
            This feature requires {requiredTier === 'team' ? 'Team' : 'Pro'} plan
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Upgrade at chytr.ai to unlock this feature
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href="https://www.chytr.ai/pricing" target="_blank" rel="noopener noreferrer">
            View pricing
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}
