import { load as cheerioLoad } from 'cheerio'
import type { SeoResult, AuditIssue } from '../types.js'

export function auditSeo(html: string, url: string): SeoResult {
  const $ = cheerioLoad(html)
  const issues: string[] = []

  const title = $('title').first().text().trim()
  const description = $('meta[name="description"]').attr('content')?.trim()
  const canonical = $('link[rel="canonical"]').attr('href')
  const robotsMeta = $('meta[name="robots"]').attr('content')
  const ogTitle = $('meta[property="og:title"]').attr('content')
  const ogDescription = $('meta[property="og:description"]').attr('content')
  const ogImage = $('meta[property="og:image"]').attr('content')
  const hasStructuredData = $('script[type="application/ld+json"]').length > 0
  const hasHreflang = $('link[rel="alternate"][hreflang]').length > 0
  const lang = $('html').attr('lang')

  const h1s = $('h1')
  const h2s = $('h2')
  const h1Count = h1s.length
  const h1Text = h1s.first().text().trim()
  const h2Count = h2s.length

  const bodyText = $('body').text().replace(/\s+/g, ' ').trim()
  const wordCount = bodyText.split(' ').filter(Boolean).length

  // Title checks
  if (!title) issues.push('Missing page title')
  else if (title.length < 30) issues.push(`Title too short: ${title.length} chars (recommended: 50-60)`)
  else if (title.length > 65) issues.push(`Title too long: ${title.length} chars (may be truncated in SERPs)`)

  // Description checks
  if (!description) issues.push('Missing meta description')
  else if (description.length < 70) issues.push(`Meta description too short: ${description.length} chars`)
  else if (description.length > 165) issues.push(`Meta description too long: ${description.length} chars`)

  // Heading checks
  if (h1Count === 0) issues.push('No H1 heading found')
  else if (h1Count > 1) issues.push(`Multiple H1 headings: ${h1Count} found (use only one)`)

  // Language
  if (!lang) issues.push('Missing lang attribute on <html> element')

  // Images without alt
  const imgsWithoutAlt = $('img:not([alt])').length
  const imgsWithEmptyAlt = $('img[alt=""]').length
  if (imgsWithoutAlt > 0) issues.push(`${imgsWithoutAlt} image(s) missing alt attribute`)
  if (imgsWithEmptyAlt > 0 && imgsWithEmptyAlt > imgsWithoutAlt) issues.push(`${imgsWithEmptyAlt} image(s) with empty alt attribute`)

  // Canonical
  if (!canonical) issues.push('No canonical URL specified')
  else if (canonical !== url && !url.includes(canonical)) {
    issues.push(`Canonical URL differs from page URL`)
  }

  // Noindex check
  if (robotsMeta?.includes('noindex')) issues.push('Page has noindex directive')
  if (robotsMeta?.includes('nofollow')) issues.push('Page has nofollow directive')

  // Word count
  if (wordCount < 100) issues.push(`Low content: only ${wordCount} words found`)

  return {
    title: title || undefined,
    titleLength: title ? title.length : undefined,
    description: description || undefined,
    descriptionLength: description ? description.length : undefined,
    h1Count,
    h1Text: h1Text || undefined,
    h2Count,
    canonical: canonical || undefined,
    robotsMeta: robotsMeta || undefined,
    ogTitle: ogTitle || undefined,
    ogDescription: ogDescription || undefined,
    ogImage: ogImage || undefined,
    structuredData: hasStructuredData,
    hreflang: hasHreflang,
    wordCount,
    issues,
  }
}

export function seoToIssues(
  result: SeoResult,
  auditId: string,
  pageId: string,
  url: string
): Omit<AuditIssue, 'id'>[] {
  const issues: Omit<AuditIssue, 'id'>[] = []

  for (const issue of result.issues) {
    let severity: AuditIssue['severity'] = 'medium'
    let recommendation = ''

    if (issue.includes('Missing page title')) {
      severity = 'high'; recommendation = 'Add a descriptive <title> tag between 50-60 characters.'
    } else if (issue.includes('Missing meta description')) {
      severity = 'medium'; recommendation = 'Add a <meta name="description"> tag with 70-165 characters.'
    } else if (issue.includes('No H1')) {
      severity = 'high'; recommendation = 'Add exactly one H1 heading that describes the page content.'
    } else if (issue.includes('Multiple H1')) {
      severity = 'medium'; recommendation = 'Use only one H1 per page. Use H2-H6 for subheadings.'
    } else if (issue.includes('missing alt')) {
      severity = 'high'; recommendation = 'Add descriptive alt attributes to all meaningful images.'
    } else if (issue.includes('noindex')) {
      severity = 'critical'; recommendation = 'Remove noindex if this page should appear in search results.'
    } else if (issue.includes('Missing lang')) {
      severity = 'medium'; recommendation = 'Add lang="en" (or appropriate language code) to the <html> element.'
    } else {
      recommendation = 'Review and address this SEO issue.'
    }

    issues.push({
      auditId,
      pageId,
      category: 'seo',
      severity,
      title: issue,
      description: issue,
      recommendation,
      url,
    })
  }

  return issues
}

export function scoreSeo(result: SeoResult): number {
  let score = 100
  for (const issue of result.issues) {
    if (issue.includes('Missing page title') || issue.includes('No H1') || issue.includes('noindex')) score -= 15
    else if (issue.includes('Missing meta description') || issue.includes('Multiple H1') || issue.includes('missing alt')) score -= 10
    else score -= 5
  }
  return Math.max(0, score)
}
