import type { Audit, AuditDetail, AuditConfig } from './types'

const BASE = '/api'

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  createAudit(url: string, config?: Partial<AuditConfig>): Promise<Audit> {
    return request('POST', '/audits', { url, config })
  },

  listAudits(): Promise<Audit[]> {
    return request('GET', '/audits')
  },

  getAudit(id: string): Promise<AuditDetail> {
    return request('GET', `/audits/${id}`)
  },

  getIssues(id: string, params?: { pageId?: string; category?: string; severity?: string }): Promise<AuditDetail['issues']> {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]).toString() : ''
    return request('GET', `/audits/${id}/issues${qs}`)
  },

  deleteAudit(id: string): Promise<{ deleted: boolean }> {
    return request('DELETE', `/audits/${id}`)
  },

  streamProgress(id: string, onEvent: (event: string, data: unknown) => void): () => void {
    const es = new EventSource(`/api/audits/${id}/progress`)
    const handler = (eventName: string) => (e: MessageEvent) => onEvent(eventName, JSON.parse(e.data))
    const events = ['init', 'status', 'crawled', 'audited', 'error', 'complete', 'failed', 'progress']
    events.forEach((ev) => es.addEventListener(ev, handler(ev) as EventListener))
    es.onerror = () => es.close()
    return () => es.close()
  },
}
