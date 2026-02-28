import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey } from '@/lib/api-auth'
import { createSupabaseServiceClient } from '@/lib/supabase'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await validateApiKey(req)
  if (!auth.valid) return auth.response!

  try {
    const { id } = await params
    const supabase = createSupabaseServiceClient()

    const { data, error } = await supabase.rpc('get_work_order', {
      p_work_order_id: id,
    })

    if (error || !data) {
      return NextResponse.json({ error: 'Work order not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[work-orders/GET/:id] unexpected error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
