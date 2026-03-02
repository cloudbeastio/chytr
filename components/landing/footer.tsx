import Link from 'next/link'
import { Activity } from 'lucide-react'

export function Footer() {
  return (
    <footer className="border-t py-12 px-6">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Activity className="h-5 w-5" />
          chytr
        </Link>
        <div className="flex items-center gap-6">
          <Link
            href="https://github.com/cloudbeastio/chytr"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            GitHub
          </Link>
          <Link
            href="https://github.com/cloudbeastio/chytr/tree/main/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Docs
          </Link>
          <Link
            href="/login"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Login
          </Link>
        </div>
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6 max-w-6xl mx-auto">
        © 2025 CloudBeast. All rights reserved.
      </p>
    </footer>
  )
}
