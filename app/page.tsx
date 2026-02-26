import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase'
import { loadLicenseFromDB } from '@/lib/license'

export default async function RootPage() {
  // Dev mode: skip auth + license checks
  if (process.env.CHYTR_DEV_MODE === 'true') {
    redirect('/dashboard')
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const license = await loadLicenseFromDB()
  if (!license && process.env.CHYTR_MODE === 'self-hosted') {
    redirect('/activate')
  }

  redirect('/dashboard')
}
