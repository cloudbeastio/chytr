export function normalizeRepoUrl(url: string): { url: string; name: string } {
  let u = url.trim()

  const sshMatch = u.match(/^git@([^:]+):(.+?)(?:\.git)?$/)
  if (sshMatch) {
    const path = sshMatch[2]
    return { url: `https://${sshMatch[1]}/${path}`, name: path }
  }

  u = u.replace(/\.git$/, '').replace(/\/$/, '')
  try {
    const parsed = new URL(u)
    return { url: u, name: parsed.pathname.replace(/^\//, '') }
  } catch {
    return { url: u, name: u }
  }
}
