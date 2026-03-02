import { SignJWT, importPKCS8 } from 'jose'
import { randomUUID } from 'crypto'
import type { LicensePayload } from './license'
import { TIER_FEATURES } from './license'

const CHYTR_PRIVATE_KEY = process.env.CHYTR_PRIVATE_KEY

const TIER_LIMITS: Record<'free' | 'pro' | 'team', LicensePayload['limits']> = {
  free: { knowledge_entries: 0, log_retention_days: 3, agent_repos: 2 },
  pro: { knowledge_entries: 5000, log_retention_days: 30, agent_repos: 10 },
  team: { knowledge_entries: 25000, log_retention_days: 90, agent_repos: 999 },
}

export async function generateLicenseJWT(
  email: string,
  tier: 'free' | 'pro' | 'team'
): Promise<string> {
  if (!CHYTR_PRIVATE_KEY) {
    throw new Error('CHYTR_PRIVATE_KEY not configured')
  }
  const privateKey = await importPKCS8(CHYTR_PRIVATE_KEY, 'RS256')
  const sub = randomUUID()
  const payload = {
    sub,
    email,
    tier,
    features: [...TIER_FEATURES[tier]],
    limits: TIER_LIMITS[tier],
  }
  const jwt = await new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(privateKey)
  return jwt
}
