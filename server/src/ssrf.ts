import dns from 'dns'
import { promisify } from 'util'

const resolve4 = promisify(dns.resolve4)
const resolve6 = promisify(dns.resolve6)

const PRIVATE_IPV4_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^0\./,
  /^::1$/,
  /^fc/,
  /^fd/,
]

const BLOCKED_HOSTNAMES = [
  '169.254.169.254',  // AWS metadata
  'metadata.google.internal',
  'metadata.azure.com',
  '100.100.100.200',  // Alibaba Cloud metadata
  'localhost',
]

const ALLOWED_PROTOCOLS = ['http:', 'https:']

export class SsrfError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SsrfError'
  }
}

export async function validateUrl(rawUrl: string): Promise<URL> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    throw new SsrfError(`Invalid URL: ${rawUrl}`)
  }

  if (!ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
    throw new SsrfError(`Protocol not allowed: ${parsed.protocol}`)
  }

  const hostname = parsed.hostname.toLowerCase()

  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    throw new SsrfError(`Blocked hostname: ${hostname}`)
  }

  // Block numeric IP addresses directly — validate against private ranges
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    if (PRIVATE_IPV4_RANGES.some((re) => re.test(hostname))) {
      throw new SsrfError(`Private/reserved IP address not allowed: ${hostname}`)
    }
  }

  // Resolve DNS and check resolved IPs
  try {
    const ips: string[] = []
    try { ips.push(...await resolve4(hostname)) } catch { /* ignore */ }
    try { ips.push(...await resolve6(hostname)) } catch { /* ignore */ }

    for (const ip of ips) {
      if (PRIVATE_IPV4_RANGES.some((re) => re.test(ip))) {
        throw new SsrfError(`Resolved to private IP: ${ip}`)
      }
    }
  } catch (err) {
    if (err instanceof SsrfError) throw err
    // DNS resolution failure — allow attempt (server may be offline, not malicious)
  }

  return parsed
}

export function isSameDomain(base: string, target: string): boolean {
  try {
    const b = new URL(base)
    const t = new URL(target)
    return b.hostname === t.hostname
  } catch {
    return false
  }
}

export function normalizeUrl(url: string, base?: string): string | null {
  try {
    const parsed = base ? new URL(url, base) : new URL(url)
    // Remove fragment
    parsed.hash = ''
    // Normalize trailing slash for root
    let normalized = parsed.toString()
    // Strip common tracking params
    const tracking = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid']
    tracking.forEach((p) => parsed.searchParams.delete(p))
    normalized = parsed.toString()
    return normalized
  } catch {
    return null
  }
}
