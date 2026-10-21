import { type Browser } from 'playwright'
import { getBrowser, closeBrowser, auditPage, generateId } from './auditors/index.js'
import { crawlSite } from './crawler.js'
import { queries } from './db.js'
import { validateUrl } from './ssrf.js'
import type { Audit, AuditPage } from './types.js'

type ProgressCallback = (auditId: string, event: string, url: string, data?: Record<string, unknown>) => void

let progressCallback: ProgressCallback | null = null
let running = false

export function setProgressCallback(cb: ProgressCallback) {
  progressCallback = cb
}

function emit(auditId: string, event: string, url: string, data?: Record<string, unknown>) {
  progressCallback?.(auditId, event, url, data)
}

async function runAudit(audit: Audit, browser: Browser): Promise<void> {
  const { id, url, config } = audit
  const auditedOrigins = new Set<string>()

  try {
    queries.updateAuditStatus(id, 'crawling')
    emit(id, 'status', url, { status: 'crawling', message: 'Starting site crawl...' })

    // Validate URL (SSRF protection)
    await validateUrl(url)

    // Crawl
    const crawlState = await crawlSite(browser, url, config, (event, pageUrl, data) => {
      emit(id, event, pageUrl, data)
      if (event === 'crawled') {
        queries.updateAuditCounts(id, { crawledPages: queries.getAudit(id)!.crawledPages + 1 })
      }
    })

    const totalCrawled = crawlState.results.length
    const totalFailed = crawlState.failed.size
    const totalSkipped = crawlState.skipped.size

    queries.updateAuditCounts(id, {
      totalPages: totalCrawled + totalFailed + totalSkipped,
      crawledPages: totalCrawled,
      failedPages: totalFailed,
    })

    // Insert page records
    const pageMap = new Map<string, string>() // url -> pageId
    for (const result of crawlState.results) {
      const pageId = generateId('page')
      const depthInfo = crawlState.discovered.get(result.url) ?? { depth: result.depth, incomingLinks: 1 }
      const pageRecord: Omit<AuditPage, 'issuesCount'> = {
        id: pageId,
        auditId: id,
        url: result.url,
        status: result.statusCode,
        contentType: result.contentType.split(';')[0].trim(),
        size: result.size,
        loadTime: result.loadTime,
        redirectUrl: result.finalUrl !== result.url ? result.finalUrl : undefined,
        crawlDepth: depthInfo.depth,
        incomingLinks: depthInfo.incomingLinks,
        auditState: 'pending',
      }
      queries.createPage(pageRecord)
      pageMap.set(result.url, pageId)
    }

    // Insert failed pages
    for (const [failedUrl, info] of crawlState.failed) {
      const pageId = generateId('page')
      const depthInfo = crawlState.discovered.get(failedUrl) ?? { depth: 0, incomingLinks: 0 }
      queries.createPage({
        id: pageId,
        auditId: id,
        url: failedUrl,
        crawlDepth: depthInfo.depth,
        incomingLinks: depthInfo.incomingLinks,
        auditState: 'failed',
      })
      queries.createIssue({
        id: generateId('issue'),
        auditId: id,
        pageId,
        category: 'reliability',
        severity: 'high',
        title: 'Page failed to load',
        description: `Page could not be loaded during crawl: ${info.error}`,
        recommendation: 'Investigate server errors or connectivity issues for this page.',
        url: failedUrl,
      })
    }

    emit(id, 'status', url, { status: 'auditing', message: `Auditing ${totalCrawled} pages...`, totalPages: totalCrawled })
    queries.updateAuditStatus(id, 'auditing')

    // Audit each crawled page
    const scoreAcc = { performance: [] as number[], accessibility: [] as number[], seo: [] as number[], security: [] as number[] }
    let auditedCount = 0

    for (const result of crawlState.results) {
      const pageId = pageMap.get(result.url)
      if (!pageId) continue

      queries.updatePage(pageId, { auditState: 'crawling' })

      try {
        const isFirstOrigin = !auditedOrigins.has(new URL(result.url).origin)
        auditedOrigins.add(new URL(result.url).origin)

        const auditResult = await auditPage(
          browser,
          result.url,
          result.html,
          {
            ...config,
            // Only run security once per origin
            includeSecurity: config.includeSecurity && isFirstOrigin,
          },
          id,
          pageId
        )

        // Update page with metrics
        queries.updatePage(pageId, {
          ...auditResult.page,
          auditState: 'audited',
        })

        // Save issues
        for (const issue of auditResult.issues) {
          queries.createIssue({ id: generateId('issue'), ...issue })
        }

        // Collect scores
        if (auditResult.performanceScore !== undefined) scoreAcc.performance.push(auditResult.performanceScore)
        if (auditResult.accessibilityScore !== undefined) scoreAcc.accessibility.push(auditResult.accessibilityScore)
        if (auditResult.seoScore !== undefined) scoreAcc.seo.push(auditResult.seoScore)
        if (auditResult.securityScore !== undefined) scoreAcc.security.push(auditResult.securityScore)

        auditedCount++
        queries.updateAuditCounts(id, { auditedPages: auditedCount })
        emit(id, 'audited', result.url, {
          issueCount: auditResult.issues.length,
          performanceScore: auditResult.performanceScore,
          accessibilityScore: auditResult.accessibilityScore,
          seoScore: auditResult.seoScore,
          securityScore: auditResult.securityScore,
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        queries.updatePage(pageId, { auditState: 'failed' })
        queries.updateAuditCounts(id, { failedPages: (queries.getAudit(id)?.failedPages ?? 0) + 1 })
        emit(id, 'error', result.url, { error: message })
      }
    }

    // Calculate aggregate scores
    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : undefined
    const perfAvg = avg(scoreAcc.performance)
    const a11yAvg = avg(scoreAcc.accessibility)
    const seoAvg = avg(scoreAcc.seo)
    const secAvg = avg(scoreAcc.security)

    const validScores = [perfAvg, a11yAvg, seoAvg, secAvg].filter((s): s is number => s !== undefined)
    const overallScore = validScores.length ? Math.round(validScores.reduce((a, b) => a + b, 0) / validScores.length) : undefined

    queries.updateAuditScores(id, {
      overall: overallScore,
      performance: perfAvg,
      accessibility: a11yAvg,
      seo: seoAvg,
      security: secAvg,
    })

    queries.updateAuditStatus(id, 'complete')
    emit(id, 'complete', url, { overallScore, auditedPages: auditedCount, failedPages: totalFailed })

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[worker] Audit ${id} failed:`, message)
    queries.updateAuditStatus(id, 'failed', message)
    emit(id, 'error', url, { error: message })
  }
}

export async function startWorker(): Promise<void> {
  if (running) return
  running = true
  console.log('[worker] Starting audit worker...')

  while (running) {
    const next = queries.getNextQueuedAudit()
    if (next) {
      console.log(`[worker] Processing audit ${next.id} for ${next.url}`)
      let browser: Browser | null = null
      try {
        browser = await getBrowser()
        await runAudit(next, browser)
      } catch (err) {
        console.error('[worker] Unhandled error:', err)
        try { queries.updateAuditStatus(next.id, 'failed', String(err)) } catch { /* ignore */ }
      }
    }
    // Poll every 2 seconds
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
}

export function stopWorker(): void {
  running = false
  closeBrowser().catch(() => {})
}
