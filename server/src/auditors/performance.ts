import type { Page } from 'playwright'
import type { PerformanceMetrics } from '../types.js'

declare global {
  interface Window {
    __sp_lcp: number
    __sp_cls: number
    __sp_tbt: number
    __sp_longTasks: number
  }
}

export async function setupPerformanceObservers(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__sp_lcp = 0
    window.__sp_cls = 0
    window.__sp_tbt = 0
    window.__sp_longTasks = 0

    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries()
        if (entries.length) window.__sp_lcp = entries[entries.length - 1].startTime
      }).observe({ type: 'largest-contentful-paint', buffered: true })

      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as { hadRecentInput?: boolean }).hadRecentInput) {
            window.__sp_cls += (entry as { value?: number }).value ?? 0
          }
        }
      }).observe({ type: 'layout-shift', buffered: true })

      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const duration = entry.duration
          if (duration > 50) window.__sp_tbt += duration - 50
          window.__sp_longTasks++
        }
      }).observe({ type: 'longtask', buffered: true })
    } catch { /* observer not supported */ }
  })
}

export async function collectPerformanceMetrics(page: Page): Promise<PerformanceMetrics> {
  // Wait for network idle to get more accurate measurements
  try {
    await page.waitForLoadState('networkidle', { timeout: 8000 })
  } catch { /* timeout ok */ }

  // Give observers time to collect data
  await page.waitForTimeout(1000)

  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    const paintEntries = performance.getEntriesByType('paint')
    const fcp = paintEntries.find((e) => e.name === 'first-contentful-paint')?.startTime ?? 0

    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
    let jsSize = 0, cssSize = 0, imageSize = 0, totalSize = 0, requestCount = 0
    const renderBlocking: string[] = []

    for (const r of resources) {
      const size = r.transferSize || r.encodedBodySize || 0
      totalSize += size
      requestCount++
      const url = r.name
      const ext = url.split('?')[0].split('.').pop()?.toLowerCase()
      if (r.initiatorType === 'script' || ext === 'js') jsSize += size
      else if (r.initiatorType === 'css' || ext === 'css') cssSize += size
      else if (['img', 'image'].includes(r.initiatorType)) imageSize += size

      // Rough render-blocking detection: CSS/JS loaded before FCP with renderBlockingStatus
      if (
        fcp > 0 && r.responseEnd < fcp &&
        (r.initiatorType === 'css' || (r.initiatorType === 'script' && r.fetchStart < fcp))
      ) {
        try { renderBlocking.push(new URL(r.name).pathname.slice(0, 60)) } catch { /* skip */ }
      }
    }

    const navBody = nav ? nav.transferSize || nav.encodedBodySize || 0 : 0

    return {
      ttfb: nav ? Math.round(nav.responseStart - nav.requestStart) : 0,
      domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd) : 0,
      loaded: nav ? Math.round(nav.loadEventEnd) : 0,
      fcp: Math.round(fcp),
      domNodes: document.querySelectorAll('*').length,
      pageWeight: totalSize + navBody,
      requestCount,
      jsSize,
      cssSize,
      imageSize,
      renderBlockingResources: [...new Set(renderBlocking)].slice(0, 10),
    }
  })

  const lcp = await page.evaluate(() => window.__sp_lcp ?? 0)
  const cls = await page.evaluate(() => Math.round((window.__sp_cls ?? 0) * 10000) / 10000)
  const tbt = await page.evaluate(() => Math.round(window.__sp_tbt ?? 0))

  return {
    ttfb: metrics.ttfb,
    fcp: metrics.fcp,
    lcp: Math.round(lcp),
    cls,
    tbt,
    domContentLoaded: metrics.domContentLoaded,
    loaded: metrics.loaded,
    domNodes: metrics.domNodes,
    pageWeight: metrics.pageWeight,
    requestCount: metrics.requestCount,
    jsSize: metrics.jsSize,
    cssSize: metrics.cssSize,
    imageSize: metrics.imageSize,
    renderBlockingResources: metrics.renderBlockingResources,
  }
}

export interface PerformanceIssue {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  title: string
  description: string
  recommendation: string
  evidence?: string
}

export function analyzePerformance(metrics: PerformanceMetrics): PerformanceIssue[] {
  const issues: PerformanceIssue[] = []

  if (metrics.lcp > 4000) {
    issues.push({ severity: 'critical', title: 'Poor Largest Contentful Paint', description: `LCP is ${metrics.lcp}ms (threshold: 4000ms for "poor")`, recommendation: 'Optimize the largest visible element: preload key assets, reduce server response times, eliminate render-blocking resources.', evidence: `LCP: ${metrics.lcp}ms` })
  } else if (metrics.lcp > 2500) {
    issues.push({ severity: 'high', title: 'Needs Improvement: Largest Contentful Paint', description: `LCP is ${metrics.lcp}ms (good is under 2500ms)`, recommendation: 'Consider preloading the LCP image or font, and optimize server response time.', evidence: `LCP: ${metrics.lcp}ms` })
  }

  if (metrics.cls > 0.25) {
    issues.push({ severity: 'critical', title: 'Poor Cumulative Layout Shift', description: `CLS score is ${metrics.cls} (threshold: 0.25 for "poor")`, recommendation: 'Add explicit width/height to images and embeds, avoid inserting content above existing content.', evidence: `CLS: ${metrics.cls}` })
  } else if (metrics.cls > 0.1) {
    issues.push({ severity: 'high', title: 'Needs Improvement: Cumulative Layout Shift', description: `CLS score is ${metrics.cls} (good is under 0.1)`, recommendation: 'Reserve space for dynamic content and lazy-loaded images.', evidence: `CLS: ${metrics.cls}` })
  }

  if (metrics.tbt > 600) {
    issues.push({ severity: 'critical', title: 'High Total Blocking Time', description: `TBT is ${metrics.tbt}ms (threshold: 600ms for "poor")`, recommendation: 'Break up long JavaScript tasks, defer non-critical scripts, remove unused JavaScript.', evidence: `TBT: ${metrics.tbt}ms` })
  } else if (metrics.tbt > 200) {
    issues.push({ severity: 'high', title: 'Elevated Total Blocking Time', description: `TBT is ${metrics.tbt}ms`, recommendation: 'Split large bundles and move expensive work off the main thread.', evidence: `TBT: ${metrics.tbt}ms` })
  }

  if (metrics.fcp > 3000) {
    issues.push({ severity: 'high', title: 'Slow First Contentful Paint', description: `FCP is ${metrics.fcp}ms (good is under 1800ms)`, recommendation: 'Eliminate render-blocking resources, reduce server response time.', evidence: `FCP: ${metrics.fcp}ms` })
  }

  if (metrics.ttfb > 800) {
    issues.push({ severity: 'high', title: 'Slow Time To First Byte', description: `TTFB is ${metrics.ttfb}ms (good is under 200ms)`, recommendation: 'Improve server performance, use a CDN, enable response caching.', evidence: `TTFB: ${metrics.ttfb}ms` })
  }

  if (metrics.domNodes > 1500) {
    issues.push({ severity: metrics.domNodes > 3000 ? 'high' : 'medium', title: 'Excessive DOM Size', description: `Page has ${metrics.domNodes} DOM nodes (recommended max: 1500)`, recommendation: 'Remove unnecessary wrappers, implement virtualization for long lists.', evidence: `DOM nodes: ${metrics.domNodes}` })
  }

  const pageMB = metrics.pageWeight / 1024 / 1024
  if (pageMB > 5) {
    issues.push({ severity: 'high', title: 'Very Large Page Weight', description: `Page transfers ${pageMB.toFixed(1)} MB of resources`, recommendation: 'Optimize and compress images, enable Gzip/Brotli, remove unused scripts and styles.', evidence: `Page weight: ${pageMB.toFixed(1)} MB` })
  } else if (pageMB > 2) {
    issues.push({ severity: 'medium', title: 'Large Page Weight', description: `Page transfers ${pageMB.toFixed(1)} MB`, recommendation: 'Review and compress large resources.', evidence: `Page weight: ${pageMB.toFixed(1)} MB` })
  }

  if (metrics.renderBlockingResources.length > 0) {
    issues.push({ severity: 'medium', title: 'Render-Blocking Resources', description: `${metrics.renderBlockingResources.length} resources may be blocking the initial render`, recommendation: 'Defer non-critical scripts, inline critical CSS, preload key assets.', evidence: metrics.renderBlockingResources.join(', ') })
  }

  const jsMB = metrics.jsSize / 1024 / 1024
  if (jsMB > 1) {
    issues.push({ severity: jsMB > 2 ? 'high' : 'medium', title: 'Large JavaScript Bundle', description: `${jsMB.toFixed(1)} MB of JavaScript transferred`, recommendation: 'Apply code splitting, tree-shaking, and remove unused dependencies.', evidence: `JS size: ${jsMB.toFixed(1)} MB` })
  }

  return issues
}

export function scorePerformance(metrics: PerformanceMetrics): number {
  let score = 100

  // LCP scoring (weight: 25%)
  if (metrics.lcp > 4000) score -= 25
  else if (metrics.lcp > 2500) score -= 15
  else if (metrics.lcp > 1500) score -= 5

  // CLS scoring (weight: 15%)
  if (metrics.cls > 0.25) score -= 15
  else if (metrics.cls > 0.1) score -= 8

  // TBT scoring (weight: 20%)
  if (metrics.tbt > 600) score -= 20
  else if (metrics.tbt > 200) score -= 10
  else if (metrics.tbt > 50) score -= 3

  // FCP scoring (weight: 10%)
  if (metrics.fcp > 3000) score -= 10
  else if (metrics.fcp > 1800) score -= 5

  // TTFB (weight: 10%)
  if (metrics.ttfb > 800) score -= 10
  else if (metrics.ttfb > 200) score -= 5

  // DOM / weight
  if (metrics.domNodes > 3000) score -= 10
  else if (metrics.domNodes > 1500) score -= 5

  const pageMB = metrics.pageWeight / 1024 / 1024
  if (pageMB > 5) score -= 10
  else if (pageMB > 2) score -= 5

  return Math.max(0, score)
}
