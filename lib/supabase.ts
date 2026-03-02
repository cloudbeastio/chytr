import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Browser-safe client — safe to import in client components
export function createSupabaseClient() {
  return createClient<Database>(supabaseUrl, supabaseAnonKey)
}
