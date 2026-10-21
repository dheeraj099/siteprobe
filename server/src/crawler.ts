import { chromium, type Browser, type Page } from 'playwright'
import { load as cheerioLoad } from 'cheerio'
import https from 'https'
import http from 'http'
import { isSameDomain, normalizeUrl } from './ssrf.js'
import type { AuditConfig } from './types.js'

export interface CrawlResult {
  url: string
  finalUrl: string
  statusCode: number
  contentType: string
  html: string
  links: string[]
  depth: number
  loadTime: number
  size: number
  redirectChain: string[]
}

export interface CrawlerState {
  discovered: Map<string, { depth: number; incomingLinks: number }>
  results: CrawlResult[]
  failed: Map<string, { error: string; statusCode?: number }>
  skipped: Map<string, string>
  robotsDisallowed: Set<string>
}

async function fetchRobotsTxt(baseUrl: string): Promise<Set<string>> {
  const disallowed = new Set<string>()
  try {
    const robotsUrl = new URL('/robots.txt', baseUrl).toString()
    const text = await fetchText(robotsUrl)
    let inUserAgent = false
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (/^user-agent:\s*\*/i.test(trimmed)) { inUserAgent = true; continue }
      if (/^user-agent:/i.test(trimmed)) { inUserAgent = false; continue }
      if (inUserAgent && /^disallow:/i.test(trimmed)) {
        const path = trimmed.split(':')[1]?.trim()
        if (path) disallowed.add(path)
      }
    }
  } catch { /* robots.txt unavailable */ }
  return disallowed
}

async function fetchSitemapUrls(baseUrl: string): Promise<string[]> {
  const urls: string[] = []
  try {
    const robotsUrl = new URL('/robots.txt', baseUrl).toString()
    const text = await fetchText(robotsUrl)
    const sitemapMatches = text.match(/^sitemap:\s*(.+)$/gmi)
    const sitemapUrls = sitemapMatches?.map((m) => m.replace(/^sitemap:\s*/i, '').trim()) ?? []
    if (!sitemapUrls.length) sitemapUrls.push(new URL('/sitemap.xml', baseUrl).toString())

    for (const sitemapUrl of sitemapUrls.slice(0, 3)) {
      try {
        const xml = await fetchText(sitemapUrl)
        const locMatches = xml.match(/<loc>([^<]+)<\/loc>/g)
        if (locMatches) {
          for (const loc of locMatches) {
            const url = loc.replace(/<\/?loc>/g, '').trim()
            if (isSameDomain(baseUrl, url)) urls.push(url)
          }
        }
      } catch { /* individual sitemap unavailable */ }
    }
  } catch { /* sitemap unavailable */ }
  return [...new Set(urls)].slice(0, 200)
}

function fetchText(url: string, timeoutMs = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs)
    const req = mod.get(url, { headers: { 'User-Agent': 'Siteprobe/1.0 (+https://github.com/dheeraj099/siteprobe)' } }, (res) => {
      if ((res.statusCode ?? 0) >= 300 && (res.statusCode ?? 0) < 400 && res.headers.location) {
        clearTimeout(timer)
        const redirectUrl = new URL(res.headers.location, url).toString()
        if (isSameDomain(url, redirectUrl)) {
          fetchText(redirectUrl, timeoutMs).then(resolve).catch(reject)
        } else {
          reject(new Error('External redirect'))
        }
        return
      }
      let data = ''
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); if (data.length > 5_000_000) { req.destroy(); reject(new Error('Too large')) } })
      res.on('end', () => { clearTimeout(timer); resolve(data) })
      res.on('error', (e: Error) => { clearTimeout(timer); reject(e) })
    })
    req.on('error', (e: Error) => { clearTimeout(timer); reject(e) })
    req.end()
  })
}

function extractLinks(html: string, baseUrl: string, targetOrigin: string): string[] {
  const $ = cheerioLoad(html)
  const links = new Set<string>()
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return
    const normalized = normalizeUrl(href, baseUrl)
    if (!normalized) return
    try {
      const parsed = new URL(normalized)
      if (parsed.origin === targetOrigin || new URL(targetOrigin).hostname === parsed.hostname) {
        links.add(normalized)
      }
    } catch { /* skip */ }
  })
  return [...links]
}

function isDisallowed(url: string, baseUrl: string, disallowed: Set<string>): boolean {
  try {
    const parsed = new URL(url)
    const base = new URL(baseUrl)
    if (parsed.hostname !== base.hostname) return false
    const path = parsed.pathname
    for (const pattern of disallowed) {
      if (pattern && path.startsWith(pattern)) return true
    }
    return false
  } catch { return false }
}

function isCrawlable(url: string): boolean {
  try {
    const parsed = new URL(url)
    // Skip common non-HTML resources
    const ext = parsed.pathname.split('.').pop()?.toLowerCase()
    const skip = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'avif', 'mp4', 'mp3', 'zip', 'tar', 'gz', 'exe', 'dmg', 'css', 'js', 'woff', 'woff2', 'ttf', 'ico']
    if (ext && skip.includes(ext)) return false
    return true
  } catch { return false }
}

export async function crawlSite(
  browser: Browser,
  startUrl: string,
  config: AuditConfig,
  onProgress: (event: string, url: string, data?: Record<string, unknown>) => void
): Promise<CrawlerState> {
  const state: CrawlerState = {
    discovered: new Map(),
    results: [],
    failed: new Map(),
    skipped: new Map(),
    robotsDisallowed: new Set(),
  }

  const origin = new URL(startUrl).origin
  state.discovered.set(startUrl, { depth: 0, incomingLinks: 1 })

  // Fetch robots.txt and sitemap
  const [robotsDisallowed, sitemapUrls] = await Promise.all([
    fetchRobotsTxt(startUrl),
    fetchSitemapUrls(startUrl),
  ])
  state.robotsDisallowed = robotsDisallowed

  // Add sitemap URLs to discovered (at depth 1)
  for (const url of sitemapUrls) {
    if (!state.discovered.has(url)) {
      state.discovered.set(url, { depth: 1, incomingLinks: 0 })
    }
  }

  onProgress('sitemap', startUrl, { sitemapUrls: sitemapUrls.length })

  const queue = [startUrl]
  const visited = new Set<string>()

  while (queue.length > 0 && state.results.length < config.maxPages) {
    const url = queue.shift()!
    if (visited.has(url)) continue
    visited.add(url)

    const depthInfo = state.discovered.get(url) ?? { depth: 0, incomingLinks: 1 }
    if (depthInfo.depth > config.maxDepth) {
      state.skipped.set(url, `Depth limit (${config.maxDepth}) exceeded`)
      continue
    }

    if (config.respectRobotsTxt && isDisallowed(url, startUrl, robotsDisallowed)) {
      state.skipped.set(url, 'Blocked by robots.txt')
      state.robotsDisallowed.add(url)
      continue
    }

    if (!isCrawlable(url)) {
      state.skipped.set(url, 'Non-HTML resource')
      continue
    }

    const page = await browser.newPage()
    try {
      page.setDefaultTimeout(config.timeoutMs)
      const t0 = Date.now()
      const redirectChain: string[] = []

      page.on('response', (res) => {
        if (res.status() >= 300 && res.status() < 400) {
          redirectChain.push(res.url())
        }
      })

      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: config.timeoutMs })
      await page.waitForTimeout(500)

      const finalUrl = page.url()
      const statusCode = response?.status() ?? 0
      const contentType = response?.headers()['content-type'] ?? ''
      const loadTime = Date.now() - t0

      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
        state.skipped.set(url, `Non-HTML content type: ${contentType.split(';')[0]}`)
        await page.close()
        continue
      }

      const html = await page.content()
      const size = Buffer.byteLength(html, 'utf8')

      // Extract internal links
      const links = extractLinks(html, finalUrl, origin)

      // Queue new links
      for (const link of links) {
        if (!visited.has(link) && !state.discovered.has(link) && isSameDomain(startUrl, link)) {
          const linkDepth = depthInfo.depth + 1
          if (linkDepth <= config.maxDepth) {
            state.discovered.set(link, { depth: linkDepth, incomingLinks: 1 })
            queue.push(link)
          } else {
            state.discovered.set(link, { depth: linkDepth, incomingLinks: 1 })
            state.skipped.set(link, `Depth limit exceeded`)
          }
        } else if (state.discovered.has(link)) {
          const info = state.discovered.get(link)!
          state.discovered.set(link, { ...info, incomingLinks: info.incomingLinks + 1 })
        }
      }

      state.results.push({ url, finalUrl, statusCode, contentType, html, links, depth: depthInfo.depth, loadTime, size, redirectChain })
      onProgress('crawled', url, { statusCode, depth: depthInfo.depth, links: links.length })

    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      state.failed.set(url, { error: message })
      onProgress('error', url, { error: message })
    } finally {
      await page.close()
    }
  }

  // Mark remaining discovered URLs as skipped
  for (const [url] of state.discovered) {
    if (!visited.has(url) && !state.failed.has(url) && !state.skipped.has(url)) {
      state.skipped.set(url, state.results.length >= config.maxPages ? 'Page limit reached' : 'Not reached in crawl')
    }
  }

  return state
}
