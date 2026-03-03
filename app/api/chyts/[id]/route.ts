import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/session'
import { createSupabaseServiceClient } from '@/lib/supabase'

const UPDATABLE_FIELDS = [
  'objective',
  'agent_id',
  'repo_id',
  'project_id',
  'branch_name',
  'lines',
  'constraints',
  'exploration_hints',
  'reference_patterns',
  'tools',
  'verification',
  'agent_config',
  'environment',
  'deliverables',
  'metadata',
] as const

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

    const { data, error } = await supabase
      .from('chyts')
      .update(update)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Chyt not found' }, { status: 404 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[chyts/PATCH] unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
