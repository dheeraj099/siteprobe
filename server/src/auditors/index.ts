import { chromium, type Browser } from 'playwright'
import { setupPerformanceObservers, collectPerformanceMetrics, analyzePerformance, scorePerformance } from './performance.js'
import { auditAccessibility, accessibilityToIssues, scoreAccessibility } from './accessibility.js'
import { auditSeo, seoToIssues, scoreSeo } from './seo.js'
import { auditSecurity, securityToIssues, scoreSecurity } from './security.js'
import type { AuditConfig, AuditPage, AuditIssue } from '../types.js'

interface AuditPageResult {
  page: Partial<AuditPage>
  issues: Omit<AuditIssue, 'id'>[]
  performanceScore?: number
  accessibilityScore?: number
  seoScore?: number
  securityScore?: number
}

let sharedBrowser: Browser | null = null

export async function getBrowser(): Promise<Browser> {
  if (!sharedBrowser || !sharedBrowser.isConnected()) {
    sharedBrowser = await chromium.launch({
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      headless: true,
    })
  }
  return sharedBrowser
}

export async function closeBrowser(): Promise<void> {
  if (sharedBrowser?.isConnected()) {
    await sharedBrowser.close()
    sharedBrowser = null
  }
}

let uniqueId = 0
export function generateId(prefix = 'id'): string {
  return `${prefix}_${Date.now()}_${++uniqueId}_${Math.random().toString(36).slice(2, 7)}`
}

export async function auditPage(
  browser: Browser,
  url: string,
  html: string,
  config: AuditConfig,
  auditId: string,
  pageId: string,
  isMobileRun = false
): Promise<AuditPageResult> {
  const result: AuditPageResult = { page: {}, issues: [] }

  const context = await browser.newContext({
    viewport: isMobileRun ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    userAgent: isMobileRun
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      : undefined,
  })

  const page = await context.newPage()
  try {
    if (config.includePerformance) {
      await setupPerformanceObservers(page)
    }

    page.setDefaultTimeout(config.timeoutMs)
    const t0 = Date.now()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: config.timeoutMs })
    const loadTime = Date.now() - t0

    result.page.loadTime = loadTime

    // Performance
    if (config.includePerformance && !isMobileRun) {
      try {
        const metrics = await collectPerformanceMetrics(page)
        result.page.ttfb = metrics.ttfb
        result.page.fcp = metrics.fcp
        result.page.lcp = metrics.lcp
        result.page.cls = metrics.cls
        result.page.tbt = metrics.tbt
        result.page.domNodes = metrics.domNodes
        result.page.pageWeight = metrics.pageWeight

        const perfIssues = analyzePerformance(metrics)
        result.performanceScore = scorePerformance(metrics)
        for (const issue of perfIssues) {
          result.issues.push({
            auditId,
            pageId,
            category: 'performance',
            severity: issue.severity,
            title: issue.title,
            description: issue.description,
            evidence: issue.evidence,
            recommendation: issue.recommendation,
            url,
          })
        }
      } catch (err) {
        console.error('[perf]', url, err)
      }
    }

    // Accessibility
    if (config.includeAccessibility) {
      try {
        const a11y = await auditAccessibility(page)
        result.accessibilityScore = scoreAccessibility(a11y)
        const a11yIssues = accessibilityToIssues(a11y, auditId, pageId, url, generateId)
        result.issues.push(...a11yIssues)
      } catch (err) {
        console.error('[a11y]', url, err)
      }
    }

    // SEO
    if (config.includeSeo) {
      try {
        const seo = auditSeo(html, url)
        result.seoScore = scoreSeo(seo)
        const seoIssues = seoToIssues(seo, auditId, pageId, url)
        result.issues.push(...seoIssues)
      } catch (err) {
        console.error('[seo]', url, err)
      }
    }
  } finally {
    await page.close()
    await context.close()
  }

  // Security (once per origin, not per page — run on first page only)
  if (config.includeSecurity) {
    try {
      const security = await auditSecurity(url)
      result.securityScore = scoreSecurity(security)
      const secIssues = securityToIssues(security, auditId, pageId, url)
      result.issues.push(...secIssues)
    } catch (err) {
      console.error('[sec]', url, err)
    }
  }

  return result
}
