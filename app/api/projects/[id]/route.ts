import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/session'
import { createSupabaseServiceClient } from '@/lib/supabase'
import type { Project } from '@/lib/database.types'

const UPDATABLE_FIELDS = [
  'name',
  'description',
  'type',
  'status',
  'account_name',
  'account_contact',
  'account_email',
  'account_phone',
  'schedule_config',
  'budget_limit',
  'metadata',
  'is_default',
] as const

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const supabase = createSupabaseServiceClient()

    const { data: contract, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error || !contract) {
      if (error?.code === 'PGRST116') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
      return NextResponse.json({ error: error?.message ?? 'Not found' }, { status: 500 })
    }

    const { data: stats } = await supabase
      .from('project_stats')
      .select('*')
      .eq('project_id', id)
      .single()

    return NextResponse.json({ ...contract, stats: stats ?? null })
  } catch (err) {
    console.error('[projects/[id]/GET] unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const body = (await req.json()) as Record<string, unknown>
    const supabase = createSupabaseServiceClient()

    const update: Record<string, unknown> = {}
    for (const key of UPDATABLE_FIELDS) {
      if (body[key] !== undefined) update[key] = body[key]
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    if (update.is_default === true) {
      await supabase
        .from('projects')
        .update({ is_default: false })
        .eq('user_id', userId)
    }

    const { data, error } = await supabase
      .from('projects')
      .update(update)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data as Project)
  } catch (err) {
    console.error('[projects/[id]/PATCH] unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getSessionUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params
    const supabase = createSupabaseServiceClient()

    const { data: contract, error: fetchError } = await supabase
      .from('projects')
      .select('id, status')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (fetchError || !contract) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const { count } = await supabase
      .from('chyts')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', id)

    if ((count ?? 0) > 0) {
      await supabase
        .from('projects')
        .update({ status: 'closed' })
        .eq('id', id)
        .eq('user_id', userId)
      return NextResponse.json({ ok: true, closed: true })
    }

    const { error: deleteError } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (deleteError) {
      console.error('[projects/[id]/DELETE]', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, deleted: true })
  } catch (err) {
    console.error('[projects/[id]/DELETE] unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
