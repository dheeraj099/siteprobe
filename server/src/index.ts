import express from 'express'
import cors from 'cors'
import { z } from 'zod'
import { queries, initDb } from './db.js'
import { validateUrl } from './ssrf.js'
import { startWorker, setProgressCallback, stopWorker } from './worker.js'
import { generateId } from './auditors/index.js'
import { DEFAULT_CONFIG } from './types.js'
import type { Response } from 'express'

const app = express()
app.use(cors({ origin: true }))
app.use(express.json())

// SSE clients: auditId -> Set<Response>
const sseClients = new Map<string, Set<Response>>()

function sendSse(auditId: string, event: string, data: unknown) {
  const clients = sseClients.get(auditId)
  if (!clients?.size) return
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of clients) {
    try { res.write(payload) } catch { clients.delete(res) }
  }
}

// Wire worker progress to SSE
setProgressCallback((auditId, event, url, data) => {
  sendSse(auditId, event, { url, ...data, timestamp: Date.now() })
  // Also send a generic 'progress' event with latest audit state
  const audit = queries.getAudit(auditId)
  if (audit) sendSse(auditId, 'progress', audit)
})

// ---- Routes ----

// POST /api/audits — create audit
app.post('/api/audits', async (req, res) => {
  const schema = z.object({
    url: z.string().url(),
    config: z.object({
      maxPages: z.number().min(1).max(200).optional(),
      maxDepth: z.number().min(1).max(10).optional(),
      includeMobile: z.boolean().optional(),
      includePerformance: z.boolean().optional(),
      includeAccessibility: z.boolean().optional(),
      includeSeo: z.boolean().optional(),
      includeSecurity: z.boolean().optional(),
      respectRobotsTxt: z.boolean().optional(),
      concurrency: z.number().min(1).max(5).optional(),
      timeoutMs: z.number().min(5000).max(120000).optional(),
    }).optional(),
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.issues })
    return
  }

  try {
    await validateUrl(parsed.data.url)
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid URL' })
    return
  }

  const config = { ...DEFAULT_CONFIG, ...parsed.data.config }
  const audit = {
    id: generateId('audit'),
    url: parsed.data.url,
    status: 'queued' as const,
    config,
    createdAt: Date.now(),
  }

  queries.createAudit(audit)
  res.status(201).json(queries.getAudit(audit.id))
})

// GET /api/audits — list all audits
app.get('/api/audits', (_req, res) => {
  res.json(queries.listAudits())
})

// GET /api/audits/:id — get audit with pages and issues
app.get('/api/audits/:id', (req, res) => {
  const audit = queries.getAudit(req.params.id)
  if (!audit) { res.status(404).json({ error: 'Audit not found' }); return }
  const pages = queries.getPages(audit.id)
  const issues = queries.getIssues(audit.id)
  const issueCounts = queries.getIssueCounts(audit.id)
  res.json({ ...audit, pages, issues, issueCounts })
})

// GET /api/audits/:id/pages — paginated pages
app.get('/api/audits/:id/pages', (req, res) => {
  const audit = queries.getAudit(req.params.id)
  if (!audit) { res.status(404).json({ error: 'Audit not found' }); return }
  const pages = queries.getPages(audit.id)
  res.json(pages)
})

// GET /api/audits/:id/issues — issues with optional filter
app.get('/api/audits/:id/issues', (req, res) => {
  const audit = queries.getAudit(req.params.id)
  if (!audit) { res.status(404).json({ error: 'Audit not found' }); return }
  const { pageId, category, severity } = req.query as Record<string, string>
  let issues = queries.getIssues(audit.id, pageId)
  if (category) issues = issues.filter((i) => i.category === category)
  if (severity) issues = issues.filter((i) => i.severity === severity)
  res.json(issues)
})

// GET /api/audits/:id/progress — SSE stream
app.get('/api/audits/:id/progress', (req, res) => {
  const { id } = req.params
  const audit = queries.getAudit(id)
  if (!audit) { res.status(404).json({ error: 'Audit not found' }); return }

  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders()

  // Send current state immediately
  res.write(`event: init\ndata: ${JSON.stringify(audit)}\n\n`)

  if (!sseClients.has(id)) sseClients.set(id, new Set())
  const clients = sseClients.get(id)!
  clients.add(res)

  // If already complete, send complete event and close
  if (audit.status === 'complete' || audit.status === 'failed') {
    res.write(`event: ${audit.status}\ndata: ${JSON.stringify(audit)}\n\n`)
    res.end()
    clients.delete(res)
    return
  }

  // Heartbeat
  const heartbeat = setInterval(() => {
    try { res.write(':heartbeat\n\n') } catch { clearInterval(heartbeat) }
  }, 15000)

  req.on('close', () => {
    clearInterval(heartbeat)
    clients.delete(res)
    if (clients.size === 0) sseClients.delete(id)
  })
})

// DELETE /api/audits/:id
app.delete('/api/audits/:id', (req, res) => {
  const audit = queries.getAudit(req.params.id)
  if (!audit) { res.status(404).json({ error: 'Audit not found' }); return }
  queries.deleteAudit(req.params.id)
  sseClients.delete(req.params.id)
  res.json({ deleted: true })
})

// GET /api/health
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() })
})

// Start server after DB init
const PORT = parseInt(process.env.PORT ?? '3001', 10)

initDb().then(() => {
  const server = app.listen(PORT, () => {
    console.log(`[server] Siteprobe API running on http://localhost:${PORT}`)
    startWorker().catch(console.error)
  })

  process.on('SIGTERM', () => {
    console.log('[server] Shutting down...')
    stopWorker()
    server.close()
  })
  process.on('SIGINT', () => {
    stopWorker()
    server.close()
    process.exit(0)
  })
}).catch((err) => {
  console.error('[server] Failed to init DB:', err)
  process.exit(1)
})

export default app
