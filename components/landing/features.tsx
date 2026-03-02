import {
  ClipboardList,
  Activity,
  Brain,
  Calendar,
  ShieldCheck,
  BarChart3,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const FEATURES = [
  {
    icon: ClipboardList,
    title: 'Structured Work Orders',
    description:
      'Full objective, constraints, hints, verification criteria.',
  },
  {
    icon: Activity,
    title: 'Real-time Execution Trace',
    description: 'Stream every tool call, file edit, and checkpoint live.',
  },
  {
    icon: Brain,
    title: 'Knowledge Loop',
    description:
      'Auto-extract learnings into pgvector. Agents get smarter over time.',
  },
  {
    icon: Calendar,
    title: 'Scheduled Jobs',
    description: 'Cron-based recurring work orders with run history.',
  },
  {
    icon: ShieldCheck,
    title: 'Human-in-the-Loop',
    description:
      'Approval gates via Slack or AgentMail before risky actions.',
  },
  {
    icon: BarChart3,
    title: 'Usage Analytics',
    description:
      'Token spend, cost tracking, agent performance leaderboards.',
  },
]

export function Features() {
  return (
    <section id="features" className="py-24 px-6 max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold text-center mb-12">
        Everything You Need
      </h2>
      <div className="grid gap-6 md:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <Card key={title} className="p-6">
            <CardHeader className="p-0">
              <Icon className="h-8 w-8 text-primary mb-3" />
              <CardTitle className="text-lg font-semibold">{title}</CardTitle>
            </CardHeader>
            <CardContent className="p-0 pt-2">
              <CardDescription className="text-sm text-muted-foreground">
                {description}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
