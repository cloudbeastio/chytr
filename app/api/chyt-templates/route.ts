import { NextRequest, NextResponse } from 'next/server'
import { getSessionUserId } from '@/lib/session'
import { createSupabaseServiceClient } from '@/lib/supabase'
import type { ChytTemplate } from '@/lib/database.types'

export async function GET(req: NextRequest) {
  try {
    const userId = await getSessionUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const contractId = url.searchParams.get('project_id')

    const supabase = createSupabaseServiceClient()
    let query = supabase
      .from('chyt_templates')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (contractId) query = query.eq('project_id', contractId)

    const { data, error } = await query

    if (error) {
      console.error('[work-order-templates/GET]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ templates: data ?? [] })
  } catch (err) {
    console.error('[work-order-templates/GET] unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { name, description, project_id, template, metadata } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const supabase = createSupabaseServiceClient()
    const { data, error } = await supabase
      .from('chyt_templates')
      .insert({
        user_id: userId,
        name: name.trim(),
        description: description ?? null,
        project_id: project_id ?? null,
        template: template ?? {},
        metadata: metadata ?? {},
      })
      .select()
      .single()

    if (error) {
      console.error('[work-order-templates/POST]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data as ChytTemplate, { status: 201 })
  } catch (err) {
    console.error('[work-order-templates/POST] unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
