export type AuditStatus = 'queued' | 'crawling' | 'auditing' | 'complete' | 'failed'
export type PageState = 'pending' | 'crawling' | 'audited' | 'failed' | 'skipped'
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'
export type IssueCategory = 'performance' | 'accessibility' | 'seo' | 'security' | 'reliability'

export interface AuditConfig {
  maxPages: number
  maxDepth: number
  includeMobile: boolean
  includePerformance: boolean
  includeAccessibility: boolean
  includeSeo: boolean
  includeSecurity: boolean
  respectRobotsTxt: boolean
  concurrency: number
  timeoutMs: number
}

export const DEFAULT_CONFIG: AuditConfig = {
  maxPages: 20,
  maxDepth: 3,
  includeMobile: true,
  includePerformance: true,
  includeAccessibility: true,
  includeSeo: true,
  includeSecurity: true,
  respectRobotsTxt: true,
  concurrency: 2,
  timeoutMs: 30000,
}

export interface Audit {
  id: string
  url: string
  status: AuditStatus
  config: AuditConfig
  startedAt?: number
  completedAt?: number
  createdAt: number
  error?: string
  scoreOverall?: number
  scorePerformance?: number
  scoreAccessibility?: number
  scoreSeo?: number
  scoreSecurity?: number
  totalPages: number
  crawledPages: number
  auditedPages: number
  failedPages: number
}

export interface AuditPage {
  id: string
  auditId: string
  url: string
  status?: number
  title?: string
  description?: string
  contentType?: string
  size?: number
  loadTime?: number
  ttfb?: number
  fcp?: number
  lcp?: number
  cls?: number
  tbt?: number
  domNodes?: number
  pageWeight?: number
  auditState: PageState
  issuesCount: number
  crawlDepth: number
  redirectUrl?: string
  incomingLinks: number
}

export interface AuditIssue {
  id: string
  auditId: string
  pageId?: string
  category: IssueCategory
  severity: Severity
  title: string
  description: string
  evidence?: string
  recommendation: string
  url?: string
}

export interface ProgressEvent {
  type: 'crawled' | 'audited' | 'issue' | 'status' | 'complete' | 'error'
  url?: string
  message: string
  data?: Record<string, unknown>
  timestamp: number
}

export interface PerformanceMetrics {
  ttfb: number
  fcp: number
  lcp: number
  cls: number
  tbt: number
  domContentLoaded: number
  loaded: number
  domNodes: number
  pageWeight: number
  requestCount: number
  jsSize: number
  cssSize: number
  imageSize: number
  renderBlockingResources: string[]
}

export interface AccessibilityResult {
  violations: AxeViolation[]
  passes: number
  incomplete: number
}

export interface AxeViolation {
  id: string
  impact: 'critical' | 'serious' | 'moderate' | 'minor'
  description: string
  help: string
  helpUrl: string
  nodes: Array<{ html: string; target: string[]; failureSummary: string }>
}

export interface SeoResult {
  title?: string
  titleLength?: number
  description?: string
  descriptionLength?: number
  h1Count: number
  h1Text?: string
  h2Count: number
  canonical?: string
  robotsMeta?: string
  ogTitle?: string
  ogDescription?: string
  ogImage?: string
  structuredData: boolean
  hreflang: boolean
  wordCount: number
  issues: string[]
}

export interface SecurityResult {
  https: boolean
  hsts: boolean
  csp: boolean
  xContentType: boolean
  xFrame: boolean
  referrerPolicy: boolean
  xssProtection: boolean
  mixedContent: boolean
  cookieSecure?: boolean
  headers: Record<string, string>
  issues: string[]
}
