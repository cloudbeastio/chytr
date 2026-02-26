import { jwtVerify, importSPKI } from 'jose'
import { createSupabaseServiceClient } from './supabase'

export interface LicensePayload {
  sub: string
  email: string
  tier: 'free' | 'pro' | 'team'
  features: string[]
  limits: {
    knowledge_entries: number
    log_retention_days: number
    agent_repos: number
  }
  iat: number
  exp: number
}

// Embedded public key for license JWT validation
// In production, this key is issued by api.chytr.ai
// For development/self-hosted, a dev key is used
const DEV_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2a2rwplBQLF29amygykE
MmYz0+Kcj3bKBp29P2rFj7UoUzDmJIHt3N9UrNpTQ8MXoZHUkIOSGXFgGqwRbYL
CcF9mJZXVfWJWVVfMJ7CUmUCpMr5qGV1K7vXMVNHV6rqxnPfXMQ+p03qLIQR7
UPFtJ7lXkGtHPp4f0p4AAQIDAQAB
-----END PUBLIC KEY-----`

let cachedLicense: LicensePayload | null = null

function devModeLicense(): LicensePayload {
  return {
    sub: 'dev',
    email: 'dev@localhost',
    tier: 'team',
    features: [...TIER_FEATURES.team],
    limits: { knowledge_entries: 25000, log_retention_days: 90, agent_repos: 999 },
    iat: 0,
    exp: 9999999999,
  }
}

export async function validateLicenseJWT(
  token: string
): Promise<{ valid: boolean; license?: LicensePayload; error?: string }> {
  try {
    const publicKeyPem = process.env.CHYTR_PUBLIC_KEY ?? DEV_PUBLIC_KEY

    const publicKey = await importSPKI(publicKeyPem, 'RS256').catch(() => null)
    if (!publicKey) {
      return { valid: false, error: 'Failed to load verification key' }
    }

    const { payload } = await jwtVerify(token, publicKey, {
      algorithms: ['RS256'],
    })

    const license = payload as unknown as LicensePayload

    if (!license.tier || !license.features || !license.limits) {
      return { valid: false, error: 'Invalid license format' }
    }

    return { valid: true, license }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message.includes('expired')) {
      return {
        valid: false,
        error: 'License key has expired. Visit www.chytr.ai/dashboard to refresh.',
      }
    }
    return { valid: false, error: 'Invalid license key' }
  }
}

export async function validateAndStoreLicense(
  key: string
): Promise<{ valid: boolean; license?: LicensePayload; error?: string }> {
  if (process.env.CHYTR_DEV_MODE === 'true') {
    cachedLicense = devModeLicense()
    return { valid: true, license: cachedLicense }
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

  cachedLicense = result.license
  return result
}

export async function loadLicenseFromDB(): Promise<LicensePayload | null> {
  if (process.env.CHYTR_DEV_MODE === 'true') {
    cachedLicense = devModeLicense()
    return cachedLicense
  }

  if (cachedLicense) return cachedLicense

  try {
    const supabase = createSupabaseServiceClient()
    const { data } = await supabase
      .from('instance_config')
      .select('value')
      .eq('key', 'license_decoded')
      .single()

    if (data?.value) {
      cachedLicense = JSON.parse(data.value) as LicensePayload
      return cachedLicense
    }
  } catch {
    // DB not ready yet
  }
  return null
}

export function getLicense(): LicensePayload | null {
  if (process.env.CHYTR_DEV_MODE === 'true') return devModeLicense()
  return cachedLicense
}

export function isFeatureEnabled(feature: string): boolean {
  if (process.env.CHYTR_DEV_MODE === 'true') return true
  if (!cachedLicense) return false
  return cachedLicense.features.includes(feature)
}

export function getLimit(key: keyof LicensePayload['limits']): number {
  if (!cachedLicense) return 0
  return cachedLicense.limits[key] ?? 0
}

export function getTier(): 'free' | 'pro' | 'team' | null {
  return cachedLicense?.tier ?? null
}

export const TIER_FEATURES = {
  free: ['logging', 'dashboard', 'work_orders', 'agents', 'knowledge'],
  pro: [
    'logging',
    'dashboard',
    'work_orders',
    'agents',
    'knowledge',
    'scheduled_jobs',
    'approvals',
    'analytics',
  ],
  team: [
    'logging',
    'dashboard',
    'work_orders',
    'agents',
    'knowledge',
    'scheduled_jobs',
    'approvals',
    'analytics',
    'multi_user',
  ],
} as const
