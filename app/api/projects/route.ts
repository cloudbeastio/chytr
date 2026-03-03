import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/session'
import { createSupabaseServiceClient } from '@/lib/supabase'
import type { Project, ProjectStatRow } from '@/lib/database.types'

export async function GET(req: NextRequest) {
  try {
    const userId = await getSessionUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createSupabaseServiceClient()
    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const type = url.searchParams.get('type')

    let query = supabase
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (status) query = query.eq('status', status)
    if (type) query = query.eq('type', type)

    const { data: projectsData, error } = await query

    if (error) {
      console.error('[projects/GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const ids = (projectsData ?? []).map((c) => c.id)
    if (ids.length === 0) {
      return NextResponse.json({ projects: [], stats: {} })
    }

    const { data: statsRows } = await supabase
      .from('project_stats')
      .select('*')
      .in('project_id', ids)

    const statsByProjectId = (statsRows ?? []).reduce<Record<string, ProjectStatRow>>((acc, row) => {
      acc[row.project_id] = row as ProjectStatRow
      return acc
    }, {})

    const list = (projectsData ?? []).map((c) => ({
      ...c,
      stats: statsByProjectId[c.id] ?? null,
    }))

    return NextResponse.json({ projects: list })
  } catch (err) {
    console.error('[projects/GET] unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const {
      name,
      description,
      type,
      status,
      account_name,
      account_contact,
      account_email,
      account_phone,
      schedule_config,
      budget_limit,
      is_default,
      metadata,
    } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()

    if (is_default === true) {
      await supabase
        .from('projects')
        .update({ is_default: false })
        .eq('user_id', userId)
    }

    const { data: project, error } = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        name: name.trim(),
        description: description ?? null,
        type: type ?? 'one_off',
        status: status ?? 'draft',
        account_name: account_name ?? null,
        account_contact: account_contact ?? null,
        account_email: account_email ?? null,
        account_phone: account_phone ?? null,
        schedule_config: schedule_config ?? null,
        budget_limit: budget_limit ?? null,
        is_default: is_default === true,
        metadata: metadata ?? {},
      })
      .select()
      .single()

    if (error) {
      console.error('[projects/POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(project as Project, { status: 201 })
  } catch (err) {
    console.error('[projects/POST] unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
