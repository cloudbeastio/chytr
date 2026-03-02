'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

const FREE_FEATURES = [
  'Hooks + logging',
  'Structured work orders',
  'Real-time execution trace',
  'Analytics (with limits)',
  '3-day log retention',
  '2 repos',
]

const PRO_FEATURES = [
  'Everything in Free',
  'Scheduled jobs',
  'Human-in-the-loop approvals',
  'Knowledge loop (5k entries)',
  '30-day logs',
  '10 repos',
]

const TEAM_FEATURES = [
  'Everything in Pro',
  'Multi-user',
  '25k knowledge entries',
  '90-day logs',
  'Unlimited repos',
]

export function Pricing() {
  return (
    <section id="pricing" className="py-24 px-6 max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold text-center mb-12">Simple Pricing</h2>
      <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Free</CardTitle>
            <CardDescription>$0/mo</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/login">Get Started</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card className={cn('ring-2 ring-primary')}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Pro</CardTitle>
              <Badge>Popular</Badge>
            </div>
            <CardDescription>$19/mo</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button className="w-full" asChild>
              <Link href="/login">Get Started</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team</CardTitle>
            <CardDescription>$49/mo</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {TEAM_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                  {f}
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/login">Get Started</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </section>
  )
}
