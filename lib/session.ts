import { createSupabaseServerClient } from '@/lib/supabase'

export async function getSessionUserId(): Promise<string | null> {
  try {
    const supabase = await createSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id ?? null
  } catch {
    return null
  }
}
