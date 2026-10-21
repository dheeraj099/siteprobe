import { useEffect, useState, useCallback } from 'react'
import type { Audit, AuditDetail } from './types'
import { api } from './api'
import LandingPage from './components/LandingPage'
import AuditProgress from './components/AuditProgress'
import Dashboard from './components/Dashboard'

type View = 'landing' | 'progress' | 'dashboard'

export default function App() {
  const [view, setView] = useState<View>('landing')
  const [currentAuditId, setCurrentAuditId] = useState<string | null>(null)
  const [auditDetail, setAuditDetail] = useState<AuditDetail | null>(null)
  const [pastAudits, setPastAudits] = useState<Audit[]>([])

  useEffect(() => {
    api.listAudits().then(setPastAudits).catch(() => {})
  }, [])

  function handleAuditCreated(audit: Audit) {
    setCurrentAuditId(audit.id)
    setPastAudits((prev) => [audit, ...prev.filter((a) => a.id !== audit.id)])
    setView('progress')
  }

  const handleAuditComplete = useCallback((audit: Audit) => {
    setPastAudits((prev) => prev.map((a) => a.id === audit.id ? audit : a))
    api.getAudit(audit.id).then((detail) => {
      setAuditDetail(detail)
      setView('dashboard')
    }).catch(console.error)
  }, [])

  async function handleSelectAudit(id: string) {
    try {
      const detail = await api.getAudit(id)
      setAuditDetail(detail)
      setCurrentAuditId(id)
      if (detail.status === 'complete' || detail.status === 'failed') {
        setView('dashboard')
      } else {
        setView('progress')
      }
    } catch (err) {
      console.error('Failed to load audit:', err)
    }
  }

  async function handleDeleteAudit(id: string) {
    try {
      await api.deleteAudit(id)
      setPastAudits((prev) => prev.filter((a) => a.id !== id))
      if (currentAuditId === id) {
        setView('landing')
        setCurrentAuditId(null)
        setAuditDetail(null)
      }
    } catch (err) {
      console.error('Failed to delete audit:', err)
    }
  }

  function handleExport() {
    if (!auditDetail) return
    const blob = new Blob([JSON.stringify(auditDetail, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `siteprobe-${new URL(auditDetail.url).hostname}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (view === 'progress' && currentAuditId) {
    return (
      <AuditProgress
        auditId={currentAuditId}
        onComplete={handleAuditComplete}
        onBack={() => setView('landing')}
      />
    )
  }

  if (view === 'dashboard' && auditDetail) {
    return (
      <Dashboard
        audit={auditDetail}
        onBack={() => setView('landing')}
        onExport={handleExport}
      />
    )
  }

  return (
    <LandingPage
      onAuditCreated={handleAuditCreated}
      pastAudits={pastAudits}
      onSelectAudit={handleSelectAudit}
      onDeleteAudit={handleDeleteAudit}
    />
  )
}
