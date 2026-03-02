import { createHash } from 'crypto'

const PREFIX = 'chl_'

export function hashLicenseKey(plain: string): string {
  return createHash('sha256').update(plain, 'utf8').digest('hex')
}

export function licenseKeyPrefix(plain: string): string {
  return plain.slice(0, 8)
}

export function generateLicenseKeyValue(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return PREFIX + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function isLicenseKeyFormat(key: string): boolean {
  return key.startsWith(PREFIX) && key.length >= 12
}
