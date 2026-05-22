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

// ─── Landing-page tokens (light) ─────────────────────────────────────────────
const C = {
  green:       '#1b7a52',
  greenDark:   '#0a5c35',
  greenSoft:   '#e8f7ef',
  greenBorder: 'rgba(27,122,82,0.25)',
  text:        '#071a10',
  muted:       '#3e6b52',
  mutedLight:  '#7aaa8e',
  card:        '#ffffff',
  cardBorder:  'rgba(10,34,24,0.08)',
  cardShadow:  '0 2px 16px rgba(10,34,24,0.06)',
  rowHover:    'rgba(27,122,82,0.03)',
  divider:     '#f0f4f2',
  warn:        '#7a4f0a',
  warnSoft:    '#fef3e2',
  warnBorder:  'rgba(217,119,6,0.3)',
  danger:      '#7a1a0a',
  dangerSoft:  '#fdecea',
  dangerBorder:'rgba(248,113,113,0.3)',
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
          <p style={{ fontSize: 11, fontWeight: 600, color: C.greenDark, letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 8 }}>
            AI-Native Procurement
          </p>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, color: C.text, letterSpacing: '-1px', lineHeight: 1.1 }}>
            Monitoring <span style={{ color: C.green }}>&amp;</span> Market Alerts
          </h1>
          <p style={{ marginTop: 6, fontSize: 14.5, color: C.muted, lineHeight: 1.6 }}>
            Real-time volatility, component telemetry, and anomaly feeds.
          </p>
        </div>
        <button
          onClick={fetchParts}
          disabled={isLoading}
          className="flex items-center gap-2 text-sm font-semibold transition-all"
          style={{
            background: C.greenSoft,
            border: `1px solid ${C.greenBorder}`,
            color: C.green,
            padding: '9px 20px',
            borderRadius: 50,
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(27,122,82,0.18)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = C.greenSoft}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3 mb-8">
        {[
          { label: 'Total Parts',      value: parts.length,  sub: 'Components tracked',    icon: <Eye className="w-4 h-4" style={{ color: C.green }} />,          accent: C.text },
          { label: 'Active Monitors',  value: activeCount,   sub: 'Live monitoring now',   icon: <Package className="w-4 h-4" style={{ color: C.green }} />,       accent: C.green },
          { label: 'Inactive',         value: inactiveCount, sub: 'Paused — not alerting', icon: <AlertTriangle className="w-4 h-4" style={{ color: C.warn }} />,  accent: C.warn },
        ].map(({ label, value, sub, icon, accent }) => (
          <div key={label} style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow, borderRadius: 18, padding: 22 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: C.greenSoft, border: `1px solid ${C.greenBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              {icon}
            </div>
            <p style={{ fontSize: 11, fontWeight: 600, color: C.mutedLight, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 4 }}>{label}</p>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 30, fontWeight: 800, color: accent, letterSpacing: '-1px', lineHeight: 1 }}>
              {isLoading ? '—' : value}
            </p>
            <p style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Table — 2/3 */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, color: C.text }}>
              Live Telemetry Feed
            </h2>
            <div className="flex items-center gap-2 rounded-full px-4 py-2"
              style={{ background: C.greenSoft, border: `1px solid ${C.greenBorder}`, width: 230 }}>
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

          {/* Table card */}
          <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow, borderRadius: 18, overflow: 'hidden' }}>

            {isLoading && (
              <div className="flex items-center justify-center gap-3 py-20" style={{ color: C.muted }}>
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: C.green }} />
                <span className="text-sm">Loading telemetry…</span>
              </div>
            )}

            {fetchState === 'error' && (
              <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
                <AlertTriangle className="w-8 h-8" style={{ color: C.danger }} />
                <p className="font-semibold" style={{ color: C.text }}>Failed to load parts</p>
                <p className="text-sm" style={{ color: C.muted }}>{errorMessage}</p>
                <button onClick={fetchParts} className="flex items-center gap-2 text-sm font-semibold"
                  style={{ background: C.greenSoft, border: `1px solid ${C.greenBorder}`, color: C.green, padding: '8px 18px', borderRadius: 50 }}>
                  Try again
                </button>
              </div>
            )}

            {fetchState === 'success' && parts.length === 0 && (
              <div className="flex flex-col items-center gap-4 px-6 py-20 text-center">
                <div style={{ width: 52, height: 52, borderRadius: 14, background: C.greenSoft, border: `1px solid ${C.greenBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Package className="w-6 h-6" style={{ color: C.green }} />
                </div>
                <div>
                  <p className="font-semibold" style={{ color: C.text }}>No components monitored yet</p>
                  <p className="mt-1 text-sm" style={{ color: C.muted }}>Upload a BOM to start tracking.</p>
                </div>
                <Link href="/dashboard/chat">
                  <button className="flex items-center gap-2 text-sm font-semibold"
                    style={{ background: C.text, color: '#dff0e8', padding: '10px 22px', borderRadius: 50, border: `2.5px solid ${C.text}` }}>
                    <Upload className="w-4 h-4" /> Upload BOM
                  </button>
                </Link>
              </div>
            )}

            {fetchState === 'success' && parts.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.divider}`, background: C.greenSoft }}>
                      {['Date', 'MPN / Component', 'Qty', 'Metric', 'Status', ''].map(h => (
                        <th key={h} className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider"
                          style={{ color: C.muted, letterSpacing: '0.10em' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-12 text-center text-sm" style={{ color: C.muted }}>
                          No parts match &ldquo;{searchTerm}&rdquo;
                        </td>
                      </tr>
                    ) : filtered.map(part => (
                      <tr key={part.id}
                        className="transition-colors"
                        style={{ borderBottom: `1px solid ${C.divider}`, opacity: part.is_active ? 1 : 0.5 }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = C.rowHover}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                      >
                        <td className="px-5 py-4 font-mono text-sm" style={{ color: C.mutedLight }}>
                          {new Date(part.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </td>
                        <td className="px-5 py-4">
                          <p className="font-medium font-mono text-sm" style={{ color: C.text }}>{part.mpn}</p>
                          <p className="text-xs mt-0.5" style={{ color: C.mutedLight }}>{part.part_name}</p>
                        </td>
                        <td className="px-5 py-4 text-sm" style={{ color: C.muted }}>{part.quantity}</td>
                        <td className="px-5 py-4 text-sm" style={{ color: C.muted }}>Live Stock</td>
                        <td className="px-5 py-4">
                          {part.is_active ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                              style={{ background: C.greenSoft, border: `1px solid ${C.greenBorder}`, color: C.greenDark }}>
                              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: C.green }} />
                              In Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                              style={{ background: 'rgba(10,34,24,0.05)', border: `1px solid ${C.cardBorder}`, color: C.mutedLight }}>
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              disabled={togglingId === part.id}
                              onClick={() => toggleActive(part)}
                              title={part.is_active ? 'Deactivate' : 'Activate'}
                              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                              style={{ color: part.is_active ? C.green : C.mutedLight }}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = C.greenSoft}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                            >
                              {togglingId === part.id
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : part.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                            </button>

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <button
                                  disabled={deletingId === part.id}
                                  title="Delete"
                                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                                  style={{ color: C.mutedLight }}
                                  onMouseEnter={e => {
                                    (e.currentTarget as HTMLElement).style.background = C.dangerSoft;
                                    (e.currentTarget as HTMLElement).style.color = C.danger;
                                  }}
                                  onMouseLeave={e => {
                                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                                    (e.currentTarget as HTMLElement).style.color = C.mutedLight;
                                  }}
                                >
                                  {deletingId === part.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                </button>
                              </AlertDialogTrigger>
                              <AlertDialogContent style={{ background: '#fff', border: `1px solid ${C.cardBorder}`, boxShadow: '0 8px 40px rgba(10,34,24,0.12)' }}>
                                <AlertDialogHeader>
                                  <AlertDialogTitle style={{ color: C.text }}>Remove part?</AlertDialogTitle>
                                  <AlertDialogDescription style={{ color: C.muted }}>
                                    <span className="font-mono font-semibold" style={{ color: C.green }}>{part.mpn}</span>
                                    {' '}will be removed from your monitored parts. This cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel style={{ background: C.greenSoft, border: `1px solid ${C.greenBorder}`, color: C.muted }}>
                                    Cancel
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deletePart(part.id)}
                                    style={{ background: C.dangerSoft, border: `1px solid ${C.dangerBorder}`, color: C.danger }}
                                  >
                                    Remove
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

        {/* ── AI Copilot sidebar ── */}
        <div className="flex flex-col gap-4">
          <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 20, fontWeight: 700, color: C.text }}>
            AI Copilot
          </h2>

          {/* Main card — matches landing page dark AI Copilot card */}
          <div style={{ background: C.text, borderRadius: 18, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 12, color: C.mutedLight, marginBottom: 2 }}>AI Copilot</p>

            {/* Risk message */}
            <p style={{ fontSize: 13.5, color: '#dff0e8', lineHeight: 1.6 }}>
              {activeCount === 0
                ? 'No active monitors. Enable parts to detect risks.'
                : `${activeCount} part${activeCount !== 1 ? 's' : ''} under active surveillance. Anomaly detection running.`}
            </p>

            {inactiveCount > 0 && (
              <p style={{ fontSize: 12.5, color: C.mutedLight, lineHeight: 1.5, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
                {inactiveCount} inactive monitor{inactiveCount !== 1 ? 's' : ''} — re-enable to resume full telemetry coverage.
              </p>
            )}

            <button
              onClick={fetchParts}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 text-sm font-semibold transition-all"
              style={{ background: C.green, color: '#fff', padding: '11px 0', borderRadius: 50, marginTop: 4, border: 'none' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#0f5c3a'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = C.green}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Run Telemetry Check
            </button>
          </div>

          {/* Add via BOM */}
          <Link href="/dashboard/chat" className="w-full">
            <button className="w-full flex items-center justify-center gap-2 text-sm font-semibold transition-all"
              style={{ background: 'transparent', border: `2.5px solid ${C.text}`, color: C.text, padding: '11px 0', borderRadius: 50 }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(7,26,16,0.05)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              <Upload className="w-4 h-4" />
              Add Parts via BOM
            </button>
          </Link>

          {/* Summary card */}
          <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow, borderRadius: 18, padding: 20 }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 14 }}>Monitor Summary</h3>
            <div className="flex flex-col gap-3">
              {[
                { label: 'Total monitored', value: parts.length,  accent: C.text },
                { label: 'Active alerts',   value: activeCount,   accent: C.green },
                { label: 'Paused',          value: inactiveCount, accent: C.warn },
              ].map(({ label, value, accent }) => (
                <div key={label} className="flex items-center justify-between">
                  <span style={{ fontSize: 13, color: C.muted }}>{label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: accent }}>{isLoading ? '—' : value}</span>
                </div>
              ))}
            </div>

            {/* Stat strip — matching landing page */}
            <div className="grid grid-cols-3 gap-2 text-center mt-5 pt-4" style={{ borderTop: `1px solid ${C.divider}` }}>
              {[['140+', 'Distributors'], ['10+', 'Beta users'], ['98%', 'Risk coverage']].map(([num, lbl]) => (
                <div key={lbl}>
                  <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: C.green, letterSpacing: '-0.5px' }}>{num}</p>
                  <p style={{ fontSize: 10.5, color: C.mutedLight, marginTop: 1 }}>{lbl}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
