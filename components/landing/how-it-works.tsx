import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const STEPS = [
  {
    step: 1,
    title: 'Install Hooks',
    description:
      'One-line install adds the chytr skill to your Cursor agent. Lifecycle hooks capture every event.',
  },
  {
    step: 2,
    title: 'Create Work Orders',
    description:
      'Define objectives, constraints, repos. Fire via dashboard, API, or cron schedule.',
  },
  {
    step: 3,
    title: 'Agents Execute',
    description:
      'Cursor Cloud Agents pick up work orders. Full execution trace streams to your dashboard in real-time.',
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 px-6 max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
      <div className="grid gap-6 md:grid-cols-3">
        {STEPS.map(({ step, title, description }) => (
          <Card key={step}>
            <CardHeader>
              <Badge variant="secondary" className="w-fit mb-2">
                {step}
              </Badge>
              <CardTitle className="font-semibold">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-muted-foreground">
                {description}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
