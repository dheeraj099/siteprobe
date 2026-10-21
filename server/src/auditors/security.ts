import https from 'https'
import http from 'http'
import type { SecurityResult, AuditIssue } from '../types.js'

export async function auditSecurity(url: string): Promise<SecurityResult> {
  const parsed = new URL(url)
  const isHttps = parsed.protocol === 'https:'
  const headers = await fetchHeaders(url)

  const hsts = checkHeader(headers, 'strict-transport-security')
  const csp = checkHeader(headers, 'content-security-policy') || checkHeader(headers, 'content-security-policy-report-only')
  const xContentType = checkHeader(headers, 'x-content-type-options')
  const xFrame = checkHeader(headers, 'x-frame-options') || cspCoversFraming(headers)
  const referrerPolicy = checkHeader(headers, 'referrer-policy')
  const xssProtection = checkHeader(headers, 'x-xss-protection')

  // Mixed content — crude check via HTML (not exhaustive)
  let mixedContent = false
  if (isHttps) {
    try {
      const html = await fetchBody(url)
      mixedContent = /src=["']http:\/\//i.test(html) || /href=["']http:\/\//i.test(html)
    } catch { /* ignore */ }
  }

  const issues: string[] = []
  if (!isHttps) issues.push('Site not served over HTTPS')
  if (isHttps && !hsts) issues.push('Missing Strict-Transport-Security header')
  if (!csp) issues.push('Missing Content-Security-Policy header')
  if (!xContentType) issues.push('Missing X-Content-Type-Options header')
  if (!xFrame) issues.push('Missing X-Frame-Options or CSP frame-ancestors directive')
  if (!referrerPolicy) issues.push('Missing Referrer-Policy header')
  if (mixedContent) issues.push('Mixed content detected: HTTP resources on HTTPS page')

  // Warn about weak HSTS
  const hstsVal = headers['strict-transport-security']
  if (hstsVal && !hstsVal.includes('includeSubDomains')) issues.push('HSTS does not include subdomains')
  const maxAge = hstsVal?.match(/max-age=(\d+)/)?.[1]
  if (maxAge && parseInt(maxAge) < 31536000) issues.push(`HSTS max-age is low: ${maxAge}s (recommend 31536000)`)

  // Permissive X-Frame-Options check
  const xFrameVal = headers['x-frame-options']?.toUpperCase()
  if (xFrameVal === 'ALLOWALL' || xFrameVal?.includes('ALLOW-FROM')) issues.push('X-Frame-Options allows framing (potential clickjacking risk)')

  return {
    https: isHttps,
    hsts: !!hsts,
    csp: !!csp,
    xContentType: !!xContentType,
    xFrame: !!xFrame,
    referrerPolicy: !!referrerPolicy,
    xssProtection: !!xssProtection,
    mixedContent,
    headers: Object.fromEntries(
      Object.entries(headers).filter(([k]) =>
        ['strict-transport-security', 'content-security-policy', 'x-content-type-options', 'x-frame-options', 'referrer-policy', 'x-xss-protection', 'server', 'x-powered-by', 'cache-control'].includes(k)
      )
    ),
    issues,
  }
}

function checkHeader(headers: Record<string, string>, name: string): boolean {
  return name in headers && headers[name].length > 0
}

function cspCoversFraming(headers: Record<string, string>): boolean {
  const csp = headers['content-security-policy'] ?? ''
  return csp.includes('frame-ancestors')
}

function fetchHeaders(url: string, timeoutMs = 8000): Promise<Record<string, string>> {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http
    const timer = setTimeout(() => resolve({}), timeoutMs)
    mod.get(url, { headers: { 'User-Agent': 'Siteprobe/1.0' } }, (res) => {
      clearTimeout(timer)
      const headers: Record<string, string> = {}
      for (const [k, v] of Object.entries(res.headers)) {
        if (typeof v === 'string') headers[k.toLowerCase()] = v
        else if (Array.isArray(v)) headers[k.toLowerCase()] = v.join(', ')
      }
      res.destroy()
      resolve(headers)
    }).on('error', () => { clearTimeout(timer); resolve({}) })
  })
}

function fetchBody(url: string, timeoutMs = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs)
    mod.get(url, { headers: { 'User-Agent': 'Siteprobe/1.0' } }, (res) => {
      let data = ''
      res.on('data', (c: Buffer) => { data += c.toString(); if (data.length > 500_000) res.destroy() })
      res.on('end', () => { clearTimeout(timer); resolve(data) })
      res.on('error', (e: Error) => { clearTimeout(timer); reject(e) })
    }).on('error', (e: Error) => { clearTimeout(timer); reject(e) })
  })
}

export function securityToIssues(
  result: SecurityResult,
  auditId: string,
  pageId: string,
  url: string
): Omit<AuditIssue, 'id'>[] {
  const issueMap: Record<string, { severity: AuditIssue['severity']; recommendation: string }> = {
    'Site not served over HTTPS': { severity: 'critical', recommendation: 'Enable HTTPS using a TLS certificate. Free certificates are available via Let\'s Encrypt.' },
    'Missing Strict-Transport-Security header': { severity: 'high', recommendation: 'Add: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload' },
    'Missing Content-Security-Policy header': { severity: 'high', recommendation: 'Implement a Content Security Policy to control which resources can be loaded.' },
    'Missing X-Content-Type-Options header': { severity: 'medium', recommendation: 'Add: X-Content-Type-Options: nosniff' },
    'Missing X-Frame-Options or CSP frame-ancestors directive': { severity: 'medium', recommendation: 'Add: X-Frame-Options: DENY or CSP frame-ancestors \'none\'' },
    'Missing Referrer-Policy header': { severity: 'low', recommendation: 'Add: Referrer-Policy: strict-origin-when-cross-origin' },
    'Mixed content detected': { severity: 'high', recommendation: 'Update all resource URLs to use HTTPS.' },
  }

  return result.issues.map((issue) => {
    const mapped = Object.entries(issueMap).find(([k]) => issue.startsWith(k))
    return {
      auditId,
      pageId,
      category: 'security' as const,
      severity: mapped?.[1].severity ?? 'medium',
      title: issue,
      description: issue,
      recommendation: mapped?.[1].recommendation ?? 'Review and address this security configuration issue.',
      url,
    }
  })
}

export function scoreSecurity(result: SecurityResult): number {
  let score = 100
  if (!result.https) score -= 30
  if (!result.hsts) score -= 15
  if (!result.csp) score -= 20
  if (!result.xContentType) score -= 10
  if (!result.xFrame) score -= 10
  if (!result.referrerPolicy) score -= 5
  if (result.mixedContent) score -= 15
  return Math.max(0, score)
}
