'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Eye, AlertTriangle, Package, RefreshCw, Trash2,
  Loader2, Search, ToggleLeft, ToggleRight, Upload
} from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { supabase } from '@/lib/supabase'

interface MonitoredPart {
  id: string
  mpn: string
  part_name: string
  quantity: number
  is_active: boolean
  created_at: string
}

type FetchState = 'idle' | 'loading' | 'success' | 'error'

// ─── Steel Gray + Sky Blue Tokens ─────────────────────────────────────────────
const C = {
  bg:          '#1c202a',
  sidebar:     '#232833',
  green:       '#5ebcf8', // Sky Blue
  sky:         '#5ebcf8',
  greenDark:   '#7dd3fc',
  greenSoft:   'rgba(94, 188, 248, 0.10)',
  greenBorder: 'rgba(94, 188, 248, 0.25)',
  text:        '#f1f5f9',
  muted:       '#94a3b8',
  mutedLight:  '#64748b',
  card:        '#232833',
  border:      '#2f3644',
  cardBorder:  '#2f3644',
  cardShadow:  '6px 6px 12px #12141a, -6px -6px 12px #2d3443',
  shadowInner: 'inset 3px 3px 6px #12141a, inset -3px -3px 6px #2d3443',
  divider:     '#2f3644',
  rowHover:    'rgba(94, 188, 248, 0.03)',
  warn:        '#fbbf24',
  warnSoft:    'rgba(245, 158, 11, 0.12)',
  warnBorder:  'rgba(245, 158, 11, 0.3)',
  danger:      '#f87171',
  dangerSoft:  'rgba(239, 68, 68, 0.12)',
  dangerBorder:'rgba(239, 68, 68, 0.3)',
}

export default function DashboardMonitorPage() {
  const [parts, setParts]           = useState<MonitoredPart[]>([])
  const [fetchState, setFetchState] = useState<FetchState>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchParts = useCallback(async () => {
    setFetchState('loading')
    setErrorMessage('')
    const { data, error } = await supabase
      .from('monitored_parts')
      .select('id, mpn, part_name, quantity, is_active, created_at')
      .order('created_at', { ascending: false })
    if (error) { setErrorMessage(error.message); setFetchState('error'); return }
    setParts(data ?? [])
    setFetchState('success')
  }, [])

  useEffect(() => { fetchParts() }, [fetchParts])

  async function toggleActive(part: MonitoredPart) {
    setTogglingId(part.id)
    const { error } = await supabase
      .from('monitored_parts')
      .update({ is_active: !part.is_active })
      .eq('id', part.id)
    if (!error)
      setParts(prev => prev.map(p => p.id === part.id ? { ...p, is_active: !p.is_active } : p))
    setTogglingId(null)
  }

  async function deletePart(id: string) {
    setDeletingId(id)
    const { error } = await supabase.from('monitored_parts').delete().eq('id', id)
    if (!error) setParts(prev => prev.filter(p => p.id !== id))
    setDeletingId(null)
  }

  const filtered = parts.filter(p => {
    const q = searchTerm.toLowerCase()
    return p.mpn.toLowerCase().includes(q) || p.part_name.toLowerCase().includes(q)
  })

  const activeCount   = parts.filter(p => p.is_active).length
  const inactiveCount = parts.length - activeCount
  const isLoading     = fetchState === 'loading'

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: C.text }}>

      {/* ── Page header ── */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>
            AI-Native Sourcing Telemetry
          </p>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, color: C.text, letterSpacing: '-1px', lineHeight: 1.1 }}>
            Monitoring <span style={{ color: C.green }}>&amp;</span> Telemetry
          </h1>
          <p style={{ marginTop: 6, fontSize: 14.5, color: C.muted, lineHeight: 1.6 }}>
            Real-time supply chain volatility, component active status feeds, and market checks.
          </p>
        </div>
        <button
          onClick={fetchParts}
          disabled={isLoading}
          className="flex items-center gap-2 text-sm font-bold transition-all shadow-neu-raised-sm"
          style={{
            background: C.card,
            border: `1.5px solid ${C.cardBorder}`,
            color: C.green,
            padding: '9px 20px',
            borderRadius: 50,
            cursor: 'pointer'
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.greenSoft; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.card; }}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Telemetry Check
        </button>
      </div>

      {/* ── Bento Grid Metric Cards (3 Columns) ── */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 mb-8">
        {[
          { label: 'Total Components', value: parts.length,  sub: 'Active & paused parts', icon: <Eye className="w-4 h-4" style={{ color: C.green }} />,          accent: C.text },
          { label: 'Active Monitors',  value: activeCount,   sub: 'Under live surveillance', icon: <Package className="w-4 h-4" style={{ color: C.green }} />,       accent: C.green },
          { label: 'Paused Tracks',    value: inactiveCount, sub: 'Not generating alerts',   icon: <AlertTriangle className="w-4 h-4" style={{ color: C.warn }} />,  accent: C.warn },
        ].map(({ label, value, sub, icon, accent }) => (
          <div key={label} style={{ background: C.card, border: `1.5px solid ${C.cardBorder}`, boxShadow: C.cardShadow, borderRadius: 20, padding: 22 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: C.greenSoft, border: `1px solid ${C.greenBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              {icon}
            </div>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.mutedLight, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 6 }}>{label}</p>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 30, fontWeight: 800, color: accent, letterSpacing: '-1px', lineHeight: 1 }}>
              {isLoading ? '—' : value}
            </p>
            <p style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Main bento grid layout (2/3 Table + 1/3 AI Copilot) ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Telemetry Table Card — 2/3 Width */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: C.text }}>
              Active Telemetry Feed
            </h2>
            <div className="flex items-center gap-2 rounded-full px-4 py-2 shadow-neu-sunken-sm"
              style={{ background: C.bg, border: `1px solid ${C.cardBorder}`, width: 240 }}>
              <Search className="w-4 h-4 shrink-0" style={{ color: C.mutedLight }} />
              <input
                placeholder="Search MPN or name…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                disabled={isLoading}
                className="bg-transparent text-sm outline-none w-full"
                style={{ color: C.text }}
              />
            </div>
          </div>

          {/* Table container */}
          <div style={{ background: C.card, border: `1.5px solid ${C.cardBorder}`, boxShadow: C.cardShadow, borderRadius: 24, overflow: 'hidden' }}>

            {isLoading && (
              <div className="flex items-center justify-center gap-3 py-24" style={{ color: C.muted }}>
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: C.green }} />
                <span className="text-sm font-semibold">Scanning telemetry arrays…</span>
              </div>
            )}

            {fetchState === 'error' && (
              <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
                <AlertTriangle className="w-8 h-8" style={{ color: C.danger }} />
                <p className="font-bold text-lg" style={{ color: C.text }}>Telemetry Link Lost</p>
                <p className="text-sm" style={{ color: C.muted }}>{errorMessage}</p>
                <button onClick={fetchParts} className="flex items-center gap-2 text-sm font-bold transition-all shadow-neu-raised-sm"
                  style={{ background: C.bg, border: `1.5px solid ${C.cardBorder}`, color: C.green, padding: '9px 20px', borderRadius: 50, cursor: 'pointer' }}>
                  Reconnect Feed
                </button>
              </div>
            )}

            {fetchState === 'success' && parts.length === 0 && (
              <div className="flex flex-col items-center gap-4 px-6 py-20 text-center">
                <div style={{ width: 52, height: 52, borderRadius: 16, background: C.greenSoft, border: `1px solid ${C.greenBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Package className="w-6 h-6" style={{ color: C.green }} />
                </div>
                <div>
                  <p className="font-bold text-lg" style={{ color: C.text }}>No monitored components found</p>
                  <p className="mt-1 text-sm" style={{ color: C.muted }}>Upload a BOM CSV file to begin tracking active supply data.</p>
                </div>
                <Link href="/dashboard/chat">
                  <button className="flex items-center gap-2 text-sm font-bold transition-all shadow-neu-raised-sm"
                    style={{ background: C.green, color: C.bg, padding: '10px 24px', borderRadius: 50, border: 'none', cursor: 'pointer' }}>
                    <Upload className="w-4 h-4" /> Import BOM
                  </button>
                </Link>
              </div>
            )}

            {fetchState === 'success' && parts.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse" style={{ fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.divider}`, background: C.bg }}>
                      {['Imported', 'MPN / Component', 'Qty', 'Source', 'Status', ''].map(h => (
                        <th key={h} className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider"
                          style={{ color: C.muted, letterSpacing: '0.08em' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center text-sm" style={{ color: C.muted }}>
                          No parts matched your query.
                        </td>
                      </tr>
                    ) : filtered.map(part => (
                      <tr key={part.id}
                        className="transition-colors"
                        style={{ borderBottom: `1px solid ${C.divider}`, opacity: part.is_active ? 1 : 0.5 }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = C.rowHover}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                      >
                        <td className="px-5 py-4 font-mono text-xs" style={{ color: C.mutedLight, fontWeight: 600 }}>
                          {new Date(part.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-bold font-mono text-sm" style={{ color: C.text }}>{part.mpn}</p>
                          <p className="text-xs mt-1" style={{ color: C.muted }}>{part.part_name || 'Generic Component'}</p>
                        </td>
                        <td className="px-5 py-4 font-semibold" style={{ color: C.text }}>{part.quantity}</td>
                        <td className="px-5 py-4 text-xs font-semibold" style={{ color: C.muted }}>OEM Secrets</td>
                        <td className="px-5 py-4">
                          {part.is_active ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
                              style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', color: '#34d399' }}>
                              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10b981' }} />
                              Monitoring
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
                              style={{ background: 'rgba(148, 163, 184, 0.12)', border: `1px solid ${C.cardBorder}`, color: C.muted }}>
                              Paused
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              disabled={togglingId === part.id}
                              onClick={() => toggleActive(part)}
                              title={part.is_active ? 'Deactivate Monitor' : 'Activate Monitor'}
                              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors shadow-neu-raised-sm"
                              style={{ color: part.is_active ? C.green : C.muted, background: C.card, border: `1px solid ${C.cardBorder}` }}
                              onMouseEnter={e => { if (!part.is_active) (e.currentTarget as HTMLElement).style.color = C.green; }}
                              onMouseLeave={e => { if (!part.is_active) (e.currentTarget as HTMLElement).style.color = C.muted; }}
                            >
                              {togglingId === part.id
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : part.is_active ? <ToggleRight className="w-4.5 h-4.5" /> : <ToggleLeft className="w-4.5 h-4.5" />}
                            </button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button
                                  disabled={deletingId === part.id}
                                  title="Delete Track"
                                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors shadow-neu-raised-sm"
                                  style={{ color: C.muted, background: C.card, border: `1px solid ${C.cardBorder}` }}
                                  onMouseEnter={e => {
                                    (e.currentTarget as HTMLElement).style.background = C.dangerSoft;
                                    (e.currentTarget as HTMLElement).style.color = C.danger;
                                  }}
                                  onMouseLeave={e => {
                                    (e.currentTarget as HTMLElement).style.background = C.card;
                                    (e.currentTarget as HTMLElement).style.color = C.muted;
                                  }}
                                >
                                  {deletingId === part.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent style={{ background: C.card, border: `1.5px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
                                <AlertDialogHeader>
                                  <AlertDialogTitle style={{ color: C.text }}>Remove telemetry track?</AlertDialogTitle>
                                  <AlertDialogDescription style={{ color: C.muted }}>
                                    The part number <span className="font-mono font-bold" style={{ color: C.green }}>{part.mpn}</span> will be permanently deleted from monitoring list. This action cannot be reversed.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel style={{ background: C.bg, border: `1.5px solid ${C.cardBorder}`, color: C.text }}>
                                    Cancel
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deletePart(part.id)}
                                    style={{ background: '#ef4444', color: '#1c202a' }}
                                  >
                                    Remove Part
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── Sourcing AI Copilot sidebar — 1/3 Width ── */}
        <div className="flex flex-col gap-5">
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 800, color: C.text }}>
            Sourcing Agent
          </h2>

          {/* AI Copilot Panel */}
          <div style={{ background: C.card, border: `1.5px solid ${C.cardBorder}`, boxShadow: C.cardShadow, borderRadius: 24, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.sky, letterSpacing: '1px', textTransform: 'uppercase', margin: 0 }}>AI Copilot Feed</p>

            {/* Risk message */}
            <p style={{ fontSize: 13.5, color: C.text, lineHeight: 1.6, margin: 0 }}>
              {activeCount === 0
                ? 'Passive monitoring active. Activate monitored component streams to initiate live anomaly scanning.'
                : `${activeCount} telemetry component${activeCount !== 1 ? 's' : ''} under live AI supervision. Sourcing channels checked every 24 hours.`}
            </p>

            {inactiveCount > 0 && (
              <p style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5, borderTop: `1px solid ${C.border}`, paddingTop: 14, margin: 0 }}>
                {inactiveCount} tracked part{inactiveCount !== 1 ? 's are' : ' is'} paused. Turn toggles on to reactivate alerts.
              </p>
            )}

            <button
              onClick={fetchParts}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 text-sm font-bold transition-all shadow-neu-raised-sm"
              style={{ background: C.green, color: C.bg, padding: '11px 0', borderRadius: 50, marginTop: 6, border: 'none', cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.greenDark; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.green; }}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Run Sourcing Check
            </button>
          </div>

          {/* Bento Add via BOM */}
          <Link href="/dashboard/chat" className="w-full">
            <button className="w-full flex items-center justify-center gap-2 text-sm font-bold transition-all shadow-neu-raised-sm"
              style={{ background: C.card, border: `1.5px solid ${C.border}`, color: C.sky, padding: '12px 0', borderRadius: 50, cursor: 'pointer' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.border; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.card; }}
            >
              <Upload className="w-4 h-4" />
              Upload BOM CSV
            </button>
          </Link>

          {/* Metric Summary Card */}
          <div style={{ background: C.card, border: `1.5px solid ${C.cardBorder}`, boxShadow: C.cardShadow, borderRadius: 20, padding: 22 }}>
            <h3 style={{ fontSize: 13.5, fontWeight: 800, color: C.text, marginBottom: 14 }}>Surveillance Summary</h3>
            <div className="flex flex-col gap-3">
              {[
                { label: 'Tracked parts', value: parts.length,  accent: C.text },
                { label: 'Active check',   value: activeCount,   accent: C.green },
                { label: 'Paused checks',  value: inactiveCount, accent: C.warn },
              ].map(({ label, value, accent }) => (
                <div key={label} className="flex items-center justify-between">
                  <span style={{ fontSize: 13, color: C.muted }}>{label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: accent }}>{isLoading ? '—' : value}</span>
                </div>
              ))}
            </div>

            {/* Sourcing details strip */}
            <div className="grid grid-cols-3 gap-2 text-center mt-5 pt-4" style={{ borderTop: `1.5px solid ${C.divider}` }}>
              {[['140+', 'Vendors'], ['10+', 'Users'], ['98%', 'Coverage']].map(([num, lbl]) => (
                <div key={lbl}>
                  <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 800, color: C.green, letterSpacing: '-0.5px', margin: 0 }}>{num}</p>
                  <p style={{ fontSize: 10, color: C.mutedLight, marginTop: 2, margin: 0, fontWeight: 700 }}>{lbl}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
