import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { getSessionUserId } from '@/lib/session'
import { normalizeRepoUrl } from '@/lib/repo-utils'
import {
  parseRepoOwnerName,
  checkRepoHasAgentFiles,
  getRepoDefaultBranch,
  fetchCursorMeta,
} from '@/lib/github'

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = (await req.json()) as { repo_url?: string }
    const repoUrl = typeof body.repo_url === 'string' ? body.repo_url.trim() : ''
    if (!repoUrl) {
      return NextResponse.json(
        { error: 'repo_url is required' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServiceClient()
    const { data: token, error: tokenError } = await supabase.rpc('get_user_github_token', {
      p_user_id: userId,
    })
    if (tokenError) {
      console.error('[agents] get_user_github_token', tokenError)
      return NextResponse.json({ error: tokenError.message }, { status: 500 })
    }
    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Connect GitHub in Settings' },
        { status: 400 }
      )
    }

    const parsed = parseRepoOwnerName(repoUrl)
    if (!parsed) {
      return NextResponse.json(
        { error: 'Invalid GitHub repo URL' },
        { status: 400 }
      )
    }

    let defaultBranch: string
    try {
      defaultBranch = await getRepoDefaultBranch(token, parsed.owner, parsed.name)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Repo not found or no access'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    let files: { hasCursorDir: boolean; hasAgentsMd: boolean }
    try {
      files = await checkRepoHasAgentFiles(token, parsed.owner, parsed.name, defaultBranch)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not check repo'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    if (!files.hasCursorDir && !files.hasAgentsMd) {
      return NextResponse.json(
        {
          error:
            'Repo must contain a .cursor directory or AGENTS.md/agent.md to activate the agent.',
        },
        { status: 400 }
      )
    }

    let defaultConfig: Record<string, unknown> = {}
    if (files.hasCursorDir) {
      try {
        const cursorMeta = await fetchCursorMeta(token, parsed.owner, parsed.name, defaultBranch)
        defaultConfig = { cursor_meta: cursorMeta }
      } catch (err) {
        console.warn('[agents] fetchCursorMeta failed', err)
        // continue without cursor_meta
      }
    }

    const { url: normalizedUrl, name: repoName } = normalizeRepoUrl(repoUrl)

    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .insert({
        name: repoName,
        description: null,
        system_prompt: null,
        type: 'cursor',
        default_config: defaultConfig as import('@/lib/database.types').Json,
        notification_config: {},
        status: 'offline',
        user_id: userId,
      })
      .select()
      .single()

    if (agentError || !agent) {
      console.error('[agents] insert agent', agentError)
      return NextResponse.json(
        { error: agentError?.message ?? 'Failed to create agent' },
        { status: 500 }
      )
    }

    const { error: repoError } = await supabase.from('agent_repos').insert({
      agent_id: agent.id,
      repo_url: normalizedUrl,
      default_branch: defaultBranch,
      user_id: userId,
    })

    if (repoError) {
      console.error('[agents] insert agent_repos', repoError)
      await supabase.from('agents').delete().eq('id', agent.id)
      const msg = repoError.message
      return NextResponse.json(
        { error: msg && String(msg).includes('unique') ? 'Repo already linked' : msg },
        { status: 500 }
      )
    }

    return NextResponse.json(agent, { status: 201 })
  } catch (err) {
    console.error('[agents] unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
