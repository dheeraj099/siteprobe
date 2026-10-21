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

export interface AuditDetail extends Audit {
  pages: AuditPage[]
  issues: AuditIssue[]
  issueCounts: Record<string, number>
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

export interface SseEvent {
  type: string
  url?: string
  message?: string
  data?: Record<string, unknown>
  timestamp: number
}
