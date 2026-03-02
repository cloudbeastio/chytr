import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export function Hero() {
  return (
    <section className="py-24 px-6 max-w-6xl mx-auto">
      <div className="flex flex-col items-center text-center gap-6 pt-8">
        <Badge variant="secondary">Open Source Agent Platform</Badge>
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
          Work Orders for AI Agents
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          Define structured work orders, link to GitHub repos, and Cursor Cloud
          Agents execute autonomously — with full observability.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Button size="lg" asChild>
            <Link href="/login">Get Started Free</Link>
          </Button>
          <Button variant="outline" size="lg" asChild>
            <Link
              href="https://github.com/cloudbeastio/chytr"
              target="_blank"
              rel="noopener noreferrer"
            >
              View on GitHub
            </Link>
          </Button>
        </div>
        <div className="w-full max-w-2xl mt-8 rounded-lg border bg-muted/50 p-4 font-mono text-sm">
          <code className="text-foreground">
            curl -fsSL https://chytr.ai/install.sh | sh
          </code>
        </div>
      </div>
    </section>
  )
}
