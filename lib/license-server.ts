import {
  validateLicenseJWT,
  setCachedLicense,
  getLicense,
  devModeLicense,
  type LicensePayload,
} from './license'
import { createSupabaseServiceClient } from './supabase-service'

export async function validateAndStoreLicense(
  key: string
): Promise<{ valid: boolean; license?: LicensePayload; error?: string }> {
  if (process.env.CHYTR_DEV_MODE === 'true') {
    setCachedLicense(devModeLicense())
    return { valid: true, license: devModeLicense() }
  }

  const result = await validateLicenseJWT(key)
  if (!result.valid || !result.license) {
    return result
  }

  const supabase = createSupabaseServiceClient()
  await supabase.from('instance_config').upsert([
    { key: 'license_key', value: key },
    { key: 'license_decoded', value: JSON.stringify(result.license) },
    { key: 'activated_at', value: new Date().toISOString() },
  ])

  setCachedLicense(result.license)
  return result
}

export async function loadLicenseFromDB(): Promise<LicensePayload | null> {
  if (process.env.CHYTR_DEV_MODE === 'true') {
    setCachedLicense(devModeLicense())
    return devModeLicense()
  }

  const cached = getLicense()
  if (cached) return cached

  try {
    const supabase = createSupabaseServiceClient()
    const { data } = await supabase
      .from('instance_config')
      .select('value')
      .eq('key', 'license_decoded')
      .single()

    if (data?.value) {
      const license = JSON.parse(data.value) as LicensePayload
      setCachedLicense(license)
      return license
    }
  } catch {
    // DB not ready yet
  }
  return null
}
