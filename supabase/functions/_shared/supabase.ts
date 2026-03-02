import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function getLicense() {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from('instance_config')
    .select('value')
    .eq('key', 'license_decoded')
    .single()
  if (!data?.value) return null
  try {
    return JSON.parse(data.value)
  } catch {
    console.error('getLicense: failed to parse license_decoded')
    return null
  }
}

export function isFeatureEnabled(license: Record<string, unknown> | null, feature: string): boolean {
  if (!license) return false
  const features = license.features as string[] ?? []
  return features.includes(feature)
}
