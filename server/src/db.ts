import initSqlJs, { type Database } from 'sql.js'
import path from 'path'
import fs from 'fs'
import type { Audit, AuditPage, AuditIssue, AuditConfig, AuditStatus, PageState } from './types.js'

const DATA_DIR = path.join(__dirname, '..', 'data')
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
const DB_PATH = path.join(DATA_DIR, 'siteprobe.db')

let db: Database
let saveTimer: ReturnType<typeof setTimeout> | null = null

function scheduleWrite() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const data = db.export()
    fs.writeFileSync(DB_PATH, Buffer.from(data))
  }, 500)
}

export async function initDb(): Promise<void> {
  const SQL = await initSqlJs()
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH)
    db = new SQL.Database(buf)
  } else {
    db = new SQL.Database()
  }

  db.run(`PRAGMA foreign_keys = ON`)
  db.run(`
    CREATE TABLE IF NOT EXISTS audits (
      id TEXT PRIMARY KEY,
      url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      config TEXT NOT NULL,
      started_at INTEGER,
      completed_at INTEGER,
      created_at INTEGER NOT NULL,
      error TEXT,
      score_overall REAL,
      score_performance REAL,
      score_accessibility REAL,
      score_seo REAL,
      score_security REAL,
      total_pages INTEGER DEFAULT 0,
      crawled_pages INTEGER DEFAULT 0,
      audited_pages INTEGER DEFAULT 0,
      failed_pages INTEGER DEFAULT 0
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_pages (
      id TEXT PRIMARY KEY,
      audit_id TEXT NOT NULL,
      url TEXT NOT NULL,
      status INTEGER,
      title TEXT,
      description TEXT,
      content_type TEXT,
      size INTEGER,
      load_time INTEGER,
      ttfb REAL,
      fcp REAL,
      lcp REAL,
      cls REAL,
      tbt REAL,
      dom_nodes INTEGER,
      page_weight INTEGER,
      audit_state TEXT NOT NULL DEFAULT 'pending',
      issues_count INTEGER DEFAULT 0,
      crawl_depth INTEGER DEFAULT 0,
      redirect_url TEXT,
      incoming_links INTEGER DEFAULT 0
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS audit_issues (
      id TEXT PRIMARY KEY,
      audit_id TEXT NOT NULL,
      page_id TEXT,
      category TEXT NOT NULL,
      severity TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      evidence TEXT,
      recommendation TEXT,
      url TEXT
    )
  `)
  db.run(`CREATE INDEX IF NOT EXISTS idx_pages_audit ON audit_pages(audit_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_issues_audit ON audit_issues(audit_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_issues_page ON audit_issues(page_id)`)
}

function run(sql: string, params: (string | number | null | undefined)[] = []) {
  db.run(sql, params.map((p) => p ?? null) as (string | number | null)[])
  scheduleWrite()
}

function getRow<T>(sql: string, params: (string | number | null)[] = []): T | undefined {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  if (stmt.step()) {
    const row = stmt.getAsObject() as T
    stmt.free()
    return row
  }
  stmt.free()
  return undefined
}

function getRows<T>(sql: string, params: (string | number | null)[] = []): T[] {
  const stmt = db.prepare(sql)
  stmt.bind(params)
  const rows: T[] = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T)
  }
  stmt.free()
  return rows
}

type DbRow = Record<string, string | number | null>

function rowToAudit(row: DbRow): Audit {
  return {
    id: row.id as string,
    url: row.url as string,
    status: row.status as AuditStatus,
    config: JSON.parse(row.config as string) as AuditConfig,
    startedAt: row.started_at as number | undefined,
    completedAt: row.completed_at as number | undefined,
    createdAt: row.created_at as number,
    error: row.error as string | undefined,
    scoreOverall: row.score_overall as number | undefined,
    scorePerformance: row.score_performance as number | undefined,
    scoreAccessibility: row.score_accessibility as number | undefined,
    scoreSeo: row.score_seo as number | undefined,
    scoreSecurity: row.score_security as number | undefined,
    totalPages: (row.total_pages as number) || 0,
    crawledPages: (row.crawled_pages as number) || 0,
    auditedPages: (row.audited_pages as number) || 0,
    failedPages: (row.failed_pages as number) || 0,
  }
}

function rowToPage(row: DbRow): AuditPage {
  return {
    id: row.id as string,
    auditId: row.audit_id as string,
    url: row.url as string,
    status: row.status as number | undefined,
    title: row.title as string | undefined,
    description: row.description as string | undefined,
    contentType: row.content_type as string | undefined,
    size: row.size as number | undefined,
    loadTime: row.load_time as number | undefined,
    ttfb: row.ttfb as number | undefined,
    fcp: row.fcp as number | undefined,
    lcp: row.lcp as number | undefined,
    cls: row.cls as number | undefined,
    tbt: row.tbt as number | undefined,
    domNodes: row.dom_nodes as number | undefined,
    pageWeight: row.page_weight as number | undefined,
    auditState: row.audit_state as PageState,
    issuesCount: (row.issues_count as number) || 0,
    crawlDepth: (row.crawl_depth as number) || 0,
    redirectUrl: row.redirect_url as string | undefined,
    incomingLinks: (row.incoming_links as number) || 0,
  }
}

export const queries = {
  createAudit(audit: Omit<Audit, 'totalPages' | 'crawledPages' | 'auditedPages' | 'failedPages'>) {
    run(
      `INSERT INTO audits (id, url, status, config, created_at) VALUES (?, ?, ?, ?, ?)`,
      [audit.id, audit.url, audit.status, JSON.stringify(audit.config), audit.createdAt]
    )
  },

  getAudit(id: string): Audit | undefined {
    const row = getRow<DbRow>(`SELECT * FROM audits WHERE id = ?`, [id])
    return row ? rowToAudit(row) : undefined
  },

  listAudits(): Audit[] {
    return getRows<DbRow>(`SELECT * FROM audits ORDER BY created_at DESC`).map(rowToAudit)
  },

  updateAuditStatus(id: string, status: AuditStatus, error?: string) {
    if (status === 'crawling' || status === 'auditing') {
      run(`UPDATE audits SET status = ?, started_at = ? WHERE id = ?`, [status, Date.now(), id])
    } else if (status === 'complete' || status === 'failed') {
      run(`UPDATE audits SET status = ?, completed_at = ?, error = ? WHERE id = ?`, [status, Date.now(), error ?? null, id])
    } else {
      run(`UPDATE audits SET status = ? WHERE id = ?`, [status, id])
    }
  },

  updateAuditCounts(id: string, counts: { totalPages?: number; crawledPages?: number; auditedPages?: number; failedPages?: number }) {
    const parts: string[] = []
    const vals: (string | number | null)[] = []
    if (counts.totalPages !== undefined) { parts.push('total_pages = ?'); vals.push(counts.totalPages) }
    if (counts.crawledPages !== undefined) { parts.push('crawled_pages = ?'); vals.push(counts.crawledPages) }
    if (counts.auditedPages !== undefined) { parts.push('audited_pages = ?'); vals.push(counts.auditedPages) }
    if (counts.failedPages !== undefined) { parts.push('failed_pages = ?'); vals.push(counts.failedPages) }
    if (!parts.length) return
    vals.push(id)
    run(`UPDATE audits SET ${parts.join(', ')} WHERE id = ?`, vals)
  },

  updateAuditScores(id: string, scores: { overall?: number; performance?: number; accessibility?: number; seo?: number; security?: number }) {
    run(
      `UPDATE audits SET score_overall = ?, score_performance = ?, score_accessibility = ?, score_seo = ?, score_security = ? WHERE id = ?`,
      [scores.overall ?? null, scores.performance ?? null, scores.accessibility ?? null, scores.seo ?? null, scores.security ?? null, id]
    )
  },

  deleteAudit(id: string) {
    run(`DELETE FROM audit_issues WHERE audit_id = ?`, [id])
    run(`DELETE FROM audit_pages WHERE audit_id = ?`, [id])
    run(`DELETE FROM audits WHERE id = ?`, [id])
  },

  createPage(page: Omit<AuditPage, 'issuesCount'>) {
    run(
      `INSERT INTO audit_pages (id, audit_id, url, audit_state, crawl_depth, incoming_links) VALUES (?, ?, ?, ?, ?, ?)`,
      [page.id, page.auditId, page.url, page.auditState, page.crawlDepth, page.incomingLinks]
    )
  },

  updatePage(id: string, data: Partial<AuditPage>) {
    const sets: string[] = []
    const vals: (string | number | null)[] = []
    const map: Record<string, string> = {
      status: 'status', title: 'title', description: 'description',
      contentType: 'content_type', size: 'size', loadTime: 'load_time',
      ttfb: 'ttfb', fcp: 'fcp', lcp: 'lcp', cls: 'cls', tbt: 'tbt',
      domNodes: 'dom_nodes', pageWeight: 'page_weight', auditState: 'audit_state',
      issuesCount: 'issues_count', redirectUrl: 'redirect_url', incomingLinks: 'incoming_links',
    }
    for (const [key, col] of Object.entries(map)) {
      if (key in data) {
        sets.push(`${col} = ?`)
        const v = (data as Record<string, unknown>)[key]
        vals.push(v == null ? null : (v as string | number))
      }
    }
    if (!sets.length) return
    vals.push(id)
    run(`UPDATE audit_pages SET ${sets.join(', ')} WHERE id = ?`, vals)
  },

  getPages(auditId: string): AuditPage[] {
    return getRows<DbRow>(`SELECT * FROM audit_pages WHERE audit_id = ? ORDER BY crawl_depth, url`, [auditId]).map(rowToPage)
  },

  getPage(id: string): AuditPage | undefined {
    const row = getRow<DbRow>(`SELECT * FROM audit_pages WHERE id = ?`, [id])
    return row ? rowToPage(row) : undefined
  },

  createIssue(issue: AuditIssue) {
    run(
      `INSERT INTO audit_issues (id, audit_id, page_id, category, severity, title, description, evidence, recommendation, url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [issue.id, issue.auditId, issue.pageId ?? null, issue.category, issue.severity, issue.title, issue.description, issue.evidence ?? null, issue.recommendation, issue.url ?? null]
    )
    if (issue.pageId) {
      run(`UPDATE audit_pages SET issues_count = issues_count + 1 WHERE id = ?`, [issue.pageId])
    }
  },

  getIssues(auditId: string, pageId?: string): AuditIssue[] {
    const rows = pageId
      ? getRows<DbRow>(`SELECT * FROM audit_issues WHERE audit_id = ? AND page_id = ? ORDER BY severity`, [auditId, pageId])
      : getRows<DbRow>(`SELECT * FROM audit_issues WHERE audit_id = ? ORDER BY severity, category`, [auditId])
    return rows.map((r) => ({
      id: r.id as string,
      auditId: r.audit_id as string,
      pageId: r.page_id as string | undefined,
      category: r.category as AuditIssue['category'],
      severity: r.severity as AuditIssue['severity'],
      title: r.title as string,
      description: r.description as string,
      evidence: r.evidence as string | undefined,
      recommendation: r.recommendation as string,
      url: r.url as string | undefined,
    }))
  },

  getNextQueuedAudit(): Audit | undefined {
    const row = getRow<DbRow>(`SELECT * FROM audits WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1`)
    return row ? rowToAudit(row) : undefined
  },

  getIssueCounts(auditId: string): Record<string, number> {
    const rows = getRows<{ severity: string; count: number }>(`SELECT severity, COUNT(*) as count FROM audit_issues WHERE audit_id = ? GROUP BY severity`, [auditId])
    return Object.fromEntries(rows.map((r) => [r.severity, r.count]))
  },
}
