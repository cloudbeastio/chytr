import { readFileSync } from 'fs'
import { join } from 'path'
import Link from 'next/link'

export default function TermsPage() {
  let licenseMarkdown: string
  try {
    licenseMarkdown = readFileSync(join(process.cwd(), 'LICENSE.md'), 'utf-8')
  } catch {
    licenseMarkdown = 'License text unavailable.'
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-12">
        <header>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            ← Back to chytr
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight mt-4">License & Terms of Service</h1>
          <p className="text-sm text-muted-foreground mt-1">
            chytr.ai — Work orders for AI agents
          </p>
        </header>

        <section>
          <h2 className="text-lg font-semibold mb-3">Terms of Service</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            By using the hosted service at chytr.ai or self-hosting chytr, you agree to the
            Sustainable Use License below. For the hosted service, you also agree to use the
            service in accordance with our acceptable use policies and to provide accurate
            registration information. We may update these terms; continued use after changes
            constitutes acceptance.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold mb-3">Sustainable Use License</h2>
          <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
            {licenseMarkdown.split('\n').map((line, i) => {
              if (line.startsWith('### ')) {
                return (
                  <h3 key={i} className="text-sm font-semibold mt-4 mb-1">
                    {line.slice(4)}
                  </h3>
                )
              }
              if (line.startsWith('## ')) {
                return (
                  <h2 key={i} className="text-base font-semibold mt-6 mb-2">
                    {line.slice(3)}
                  </h2>
                )
              }
              if (line.startsWith('# ')) {
                return (
                  <h1 key={i} className="text-lg font-semibold mb-2">
                    {line.slice(2)}
                  </h1>
                )
              }
              if (line.trim() === '') return <p key={i} className="mb-2" />
              return (
                <p key={i} className="text-sm text-muted-foreground leading-relaxed mb-2">
                  {line}
                </p>
              )
            })}
          </div>
        </section>

        <footer className="pt-6 border-t border-border">
          <p className="text-xs text-muted-foreground">
            © Cloudbeast.io LLC. Last updated March 2025.
          </p>
        </footer>
      </div>
    </div>
  )
}
