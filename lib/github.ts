/**
 * GitHub API helpers: parse repo URL and check for agent files (.cursor, AGENTS.md, agent.md).
 */

const GITHUB_API_BASE = 'https://api.github.com'
const GITHUB_CONTENTS_TIMEOUT_MS = 10_000

export interface RepoOwnerName {
  owner: string
  name: string
}

/**
 * Parse GitHub repo URL into owner and repo name. Returns null if not a GitHub URL.
 */
export function parseRepoOwnerName(repoUrl: string): RepoOwnerName | null {
  const trimmed = repoUrl.trim()
  const sshMatch = trimmed.match(/^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i)
  if (sshMatch) {
    return { owner: sshMatch[1], name: sshMatch[2] }
  }
  if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(trimmed)) {
    const [owner, name] = trimmed.split('/')
    return owner && name ? { owner, name } : null
  }
  try {
    const u = new URL(trimmed.replace(/\.git$/, ''))
    if (u.hostname !== 'github.com' && u.hostname !== 'www.github.com') return null
    const parts = u.pathname.replace(/^\//, '').split('/').filter(Boolean)
    if (parts.length < 2) return null
    return { owner: parts[0], name: parts[1] }
  } catch {
    return null
  }
}

export interface RepoAgentFiles {
  hasCursorDir: boolean
  hasAgentsMd: boolean
}

/**
 * Check repo root for .cursor (dir) and AGENTS.md or agent.md (file). Uses branch or 'main'.
 */
export async function checkRepoHasAgentFiles(
  token: string,
  owner: string,
  repo: string,
  branch?: string
): Promise<RepoAgentFiles> {
  const ref = branch || 'main'
  const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents?ref=${encodeURIComponent(ref)}`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(GITHUB_CONTENTS_TIMEOUT_MS),
  })
  if (res.status === 401) {
    throw new Error('Invalid GitHub token')
  }
  if (res.status === 404) {
    throw new Error('Repo not found or no access')
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`GitHub API error: ${res.status} ${text.slice(0, 200)}`)
  }
  const data = (await res.json()) as Array<{ name: string; type: string }>
  const names = new Set((data || []).map((e) => e.name))
  const types = new Map((data || []).map((e) => [e.name, e.type]))
  const hasCursorDir = types.get('.cursor') === 'dir'
  const hasAgentsMd = names.has('AGENTS.md') && types.get('AGENTS.md') === 'file'
  const hasAgentMd = names.has('agent.md') && types.get('agent.md') === 'file'
  return {
    hasCursorDir: !!hasCursorDir,
    hasAgentsMd: !!(hasAgentsMd || hasAgentMd),
  }
}

/**
 * Fetch repo metadata (e.g. default_branch) from GitHub API.
 */
export async function getRepoDefaultBranch(
  token: string,
  owner: string,
  repo: string
): Promise<string> {
  const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(GITHUB_CONTENTS_TIMEOUT_MS),
  })
  if (res.status === 401) throw new Error('Invalid GitHub token')
  if (res.status === 404) throw new Error('Repo not found or no access')
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`GitHub API error: ${res.status} ${text.slice(0, 200)}`)
  }
  const data = (await res.json()) as { default_branch?: string }
  return data.default_branch || 'main'
}

/** Response shape for cursor_meta stored on agent.default_config */
export interface CursorMeta {
  skills: string[]
  commands: string[]
  hooks?: string[]
}

const GITHUB_CONTENTS_OPTIONS = {
  headers: { Accept: 'application/vnd.github.v3+json' as const },
  signal: AbortSignal.timeout(GITHUB_CONTENTS_TIMEOUT_MS),
}

/**
 * Fetch .cursor directory: list skills (.cursor/skills/), commands (.cursor/commands/), and hook names (.cursor/hooks.json).
 * Call only when .cursor exists. Returns names only; does not fetch file bodies.
 */
export async function fetchCursorMeta(
  token: string,
  owner: string,
  repo: string,
  branch: string
): Promise<CursorMeta> {
  const ref = encodeURIComponent(branch)
  const base = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents`
  const auth = { Authorization: `Bearer ${token}` }

  const result: CursorMeta = { skills: [], commands: [], hooks: [] }

  const listDir = async (path: string): Promise<Array<{ name: string; type: string }>> => {
    const res = await fetch(`${base}/${path}?ref=${ref}`, { ...GITHUB_CONTENTS_OPTIONS, headers: { ...GITHUB_CONTENTS_OPTIONS.headers, ...auth } })
    if (res.status === 404 || !res.ok) return []
    const data = (await res.json()) as Array<{ name: string; type: string }>
    return Array.isArray(data) ? data : []
  }

  const skillsDir = await listDir('.cursor/skills')
  result.skills = skillsDir.filter((e) => e.type === 'dir').map((e) => e.name)

  const commandsDir = await listDir('.cursor/commands')
  result.commands = commandsDir.filter((e) => e.type === 'file').map((e) => e.name.replace(/\.md$/i, ''))

  const hooksRes = await fetch(`${base}/.cursor/hooks.json?ref=${ref}`, { ...GITHUB_CONTENTS_OPTIONS, headers: { ...GITHUB_CONTENTS_OPTIONS.headers, ...auth } })
  if (hooksRes.ok) {
    try {
      const hooksData = (await hooksRes.json()) as { content?: string; encoding?: string }
      const raw = hooksData.encoding === 'base64' && hooksData.content
        ? Buffer.from(hooksData.content, 'base64').toString('utf-8')
        : null
      if (raw) {
        const parsed = JSON.parse(raw) as { hooks?: Record<string, unknown[]> }
        if (parsed.hooks && typeof parsed.hooks === 'object') {
          result.hooks = Object.keys(parsed.hooks)
        }
      }
    } catch {
      // ignore invalid or missing hooks.json
    }
  }

  return result
}
