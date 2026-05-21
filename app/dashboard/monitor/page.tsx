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

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonitoredPart {
  id: string
  mpn: string
  part_name: string
  quantity: number
  is_active: boolean
  created_at: string
}

type FetchState = 'idle' | 'loading' | 'success' | 'error'

// ─── Landing-page design tokens ───────────────────────────────────────────────
// Sourced from Figma export — matches omniprocure.online exactly

const C = {
  // Core greens
  green:        '#1b7a52',
  greenMid:     '#2a9b68',
  greenSoft:    'rgba(27,122,82,0.15)',
  greenBorder:  'rgba(27,122,82,0.25)',
  greenGlow:    'rgba(27,122,82,0.08)',

  // Text
  text:         '#dff0e8',          // primary text (light sage-white)
  muted:        '#7aaa8e',          // secondary text
  mutedDim:     '#3e6b52',          // tertiary / placeholder

  // Surfaces
  bg:           '#071a10',          // deepest background
  surface:      'rgba(7,26,16,0.55)',
  surfaceHover: 'rgba(27,122,82,0.06)',
  border:       'rgba(27,122,82,0.18)',
  borderSubtle: 'rgba(27,122,82,0.10)',

  // Semantic
  warn:         '#d97706',
  warnSoft:     'rgba(120,80,10,0.2)',
  warnBorder:   'rgba(217,119,6,0.35)',
  danger:       '#f87171',
  dangerSoft:   'rgba(100,20,20,0.2)',
  dangerBorder: 'rgba(248,113,113,0.3)',
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardMonitorPage() {
  const [parts, setParts]         = useState<MonitoredPart[]>([])
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

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-full" style={{ fontFamily: "'Inter', sans-serif", color: C.text }}>

      {/* ── Ambient glows (matching landing page blobs) ── */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute left-1/4 top-0 h-96 w-96 rounded-full blur-[140px]"
          style={{ background: 'radial-gradient(circle, rgba(27,122,82,0.12), transparent 70%)' }} />
        <div className="absolute bottom-1/4 right-1/4 h-[500px] w-[500px] rounded-full blur-[160px]"
          style={{ background: 'radial-gradient(circle, rgba(27,122,82,0.07), transparent 70%)' }} />
      </div>

      <div className="relative z-10 flex flex-col gap-8">

        {/* ── Page header ── */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: C.green, letterSpacing: '0.14em' }}>
              AI-NATIVE PROCUREMENT
            </p>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: C.text, fontFamily: "'Syne', sans-serif" }}>
              Monitoring <span style={{ color: C.green }}>&amp;</span> Market Alerts
            </h1>
            <p className="mt-2 text-sm" style={{ color: C.muted }}>
              Real-time volatility, component telemetry, and anomaly feeds.
            </p>
          </div>
          <button
            onClick={fetchParts}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all"
            style={{
              background: C.greenSoft,
              border: `1px solid ${C.greenBorder}`,
              color: C.green,
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(27,122,82,0.25)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = C.greenSoft}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* ── Stat cards (matching landing page card style) ── */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">

          {[
            {
              label: 'Total Parts',
              value: isLoading ? '—' : parts.length,
              sub: 'Components tracked',
              icon: <Eye className="w-4 h-4" style={{ color: C.green }} />,
              accent: C.text,
            },
            {
              label: 'Active Monitors',
              value: isLoading ? '—' : activeCount,
              sub: 'Live monitoring now',
              icon: <Package className="w-4 h-4" style={{ color: C.green }} />,
              accent: C.green,
            },
            {
              label: 'Inactive',
              value: isLoading ? '—' : inactiveCount,
              sub: 'Paused — not alerting',
              icon: <AlertTriangle className="w-4 h-4" style={{ color: C.warn }} />,
              accent: C.warn,
            },
          ].map(({ label, value, sub, icon, accent }) => (
            <div key={label} className="rounded-2xl p-5 flex flex-col gap-3"
              style={{ background: C.surface, border: `1px solid ${C.border}`, backdropFilter: 'blur(16px)' }}>
              <div className="flex items-start justify-between">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: C.greenSoft, border: `1px solid ${C.greenBorder}` }}>
                  {icon}
                </div>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest mb-1" style={{ color: C.mutedDim, letterSpacing: '0.14em' }}>{label}</p>
                <p className="text-3xl font-bold" style={{ color: accent, fontFamily: "'Syne', sans-serif" }}>{value}</p>
                <p className="text-xs mt-1" style={{ color: C.muted }}>{sub}</p>
              </div>
            </div>
          ))}

        </div>

        {/* ── Main content ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* Table — 2/3 */}
          <div className="lg:col-span-2 flex flex-col gap-4">

            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-xl font-semibold" style={{ color: C.text, fontFamily: "'Syne', sans-serif" }}>
                Live Telemetry Feed
              </h2>
              {/* Search */}
              <div className="flex items-center gap-2 rounded-full px-4 py-2"
                style={{ background: C.surface, border: `1px solid ${C.border}`, width: '230px' }}>
                <Search className="w-4 h-4 shrink-0" style={{ color: C.muted }} />
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
            <div className="overflow-hidden rounded-2xl"
              style={{ background: C.surface, backdropFilter: 'blur(16px)', border: `1px solid ${C.border}` }}>

              {isLoading && (
                <div className="flex items-center justify-center gap-3 py-20" style={{ color: C.muted }}>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Loading telemetry…</span>
                </div>
              )}

              {fetchState === 'error' && (
                <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
                  <AlertTriangle className="w-8 h-8" style={{ color: C.danger }} />
                  <p className="font-medium" style={{ color: C.text }}>Failed to load parts</p>
                  <p className="text-sm" style={{ color: C.muted }}>{errorMessage}</p>
                  <button onClick={fetchParts}
                    className="flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all"
                    style={{ background: C.greenSoft, border: `1px solid ${C.greenBorder}`, color: C.green }}>
                    Try again
                  </button>
                </div>
              )}

              {fetchState === 'success' && parts.length === 0 && (
                <div className="flex flex-col items-center gap-4 px-6 py-20 text-center">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: C.greenSoft, border: `1px solid ${C.greenBorder}` }}>
                    <Package className="w-7 h-7" style={{ color: C.green }} />
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: C.text }}>No components monitored yet</p>
                    <p className="mt-1 text-sm" style={{ color: C.muted }}>Upload a BOM to start tracking.</p>
                  </div>
                  <Link href="/dashboard/bom">
                    <button className="flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all"
                      style={{ background: C.greenSoft, border: `1px solid ${C.greenBorder}`, color: C.green }}>
                      <Upload className="w-4 h-4" />
                      Upload BOM
                    </button>
                  </Link>
                </div>
              )}

              {fetchState === 'success' && parts.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}`, background: C.greenGlow }}>
                        {['Date', 'MPN / Component', 'Qty', 'Metric', 'Status', ''].map(h => (
                          <th key={h} className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider"
                            style={{ color: C.mutedDim, letterSpacing: '0.12em' }}>
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
                          style={{
                            borderBottom: `1px solid ${C.borderSubtle}`,
                            opacity: part.is_active ? 1 : 0.5,
                          }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = C.surfaceHover}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                        >
                          <td className="px-5 py-4 font-mono text-sm" style={{ color: C.muted }}>
                            {new Date(part.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-medium font-mono text-sm" style={{ color: C.text }}>{part.mpn}</p>
                            <p className="text-xs mt-0.5" style={{ color: C.muted }}>{part.part_name}</p>
                          </td>
                          <td className="px-5 py-4 text-sm" style={{ color: C.muted }}>{part.quantity}</td>
                          <td className="px-5 py-4 text-sm" style={{ color: C.muted }}>Live Stock</td>
                          <td className="px-5 py-4">
                            {part.is_active ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                                style={{ background: C.greenSoft, border: `1px solid ${C.greenBorder}`, color: C.green }}>
                                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                                style={{ background: 'rgba(7,26,16,0.4)', border: `1px solid ${C.borderSubtle}`, color: C.mutedDim }}>
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-1">
                              {/* Toggle */}
                              <button
                                disabled={togglingId === part.id}
                                onClick={() => toggleActive(part)}
                                title={part.is_active ? 'Deactivate' : 'Activate'}
                                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                                style={{ color: part.is_active ? C.green : C.mutedDim }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = C.greenSoft}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                              >
                                {togglingId === part.id
                                  ? <Loader2 className="w-4 h-4 animate-spin" />
                                  : part.is_active
                                    ? <ToggleRight className="w-4 h-4" />
                                    : <ToggleLeft className="w-4 h-4" />}
                              </button>

                              {/* Delete */}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <button
                                    disabled={deletingId === part.id}
                                    title="Delete"
                                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                                    style={{ color: C.mutedDim }}
                                    onMouseEnter={e => {
                                      (e.currentTarget as HTMLElement).style.background = C.dangerSoft;
                                      (e.currentTarget as HTMLElement).style.color = C.danger;
                                    }}
                                    onMouseLeave={e => {
                                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                                      (e.currentTarget as HTMLElement).style.color = C.mutedDim;
                                    }}
                                  >
                                    {deletingId === part.id
                                      ? <Loader2 className="w-4 h-4 animate-spin" />
                                      : <Trash2 className="w-4 h-4" />}
                                  </button>
                                </AlertDialogTrigger>
                                <AlertDialogContent style={{
                                  background: 'rgba(7,26,16,0.97)',
                                  border: `1px solid ${C.border}`,
                                  backdropFilter: 'blur(24px)',
                                }}>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle style={{ color: C.text }}>Remove part?</AlertDialogTitle>
                                    <AlertDialogDescription style={{ color: C.muted }}>
                                      <span className="font-mono font-medium" style={{ color: C.green }}>{part.mpn}</span>
                                      {' '}will be removed from your monitored parts. This cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel style={{
                                      background: C.greenGlow,
                                      border: `1px solid ${C.border}`,
                                      color: C.muted,
                                    }}>
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

          {/* ── AI Anomaly sidebar ── */}
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold flex items-center gap-2" style={{ color: C.text, fontFamily: "'Syne', sans-serif" }}>
              <span style={{ color: C.green }}>✦</span> AI Copilot
            </h2>

            {/* Main sidebar card — matches landing AI Copilot card style */}
            <div className="rounded-2xl flex flex-col gap-3 p-5"
              style={{
                background: C.surface,
                backdropFilter: 'blur(24px)',
                border: `1px solid ${C.border}`,
                borderTop: `2px solid ${C.green}`,
              }}>

              {/* Risk block */}
              <div className="rounded-xl p-4" style={{ background: C.dangerSoft, border: `1px solid ${C.dangerBorder}` }}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: C.danger }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: C.text }}>Critical Risk Detected</p>
                    <p className="mt-1 text-xs leading-relaxed" style={{ color: '#ffb3b3' }}>
                      {activeCount === 0
                        ? 'No active monitors. Enable parts to detect risks.'
                        : `${activeCount} part${activeCount !== 1 ? 's' : ''} under active surveillance. Anomaly detection running.`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Pattern block */}
              <div className="rounded-xl p-4" style={{ background: C.greenGlow, border: `1px solid ${C.borderSubtle}` }}>
                <div className="flex items-start gap-3">
                  <Eye className="w-4 h-4 mt-0.5 shrink-0" style={{ color: C.green }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: C.text }}>Pattern Anomaly</p>
                    <p className="mt-1 text-xs leading-relaxed" style={{ color: C.muted }}>
                      {inactiveCount > 0
                        ? `${inactiveCount} inactive monitor${inactiveCount !== 1 ? 's' : ''} — re-enable to resume full telemetry coverage.`
                        : 'All monitors active. Watching for unusual purchasing patterns across suppliers.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={fetchParts}
                  disabled={isLoading}
                  className="w-full rounded-full py-2.5 text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                  style={{ background: C.green, color: '#fff' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = C.greenMid}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = C.green}
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  Run Telemetry Check
                </button>
                <Link href="/dashboard/bom" className="w-full">
                  <button className="w-full rounded-full py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-all"
                    style={{ background: 'transparent', border: `1px solid ${C.greenBorder}`, color: C.green }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = C.greenSoft}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <Upload className="w-4 h-4" />
                    Add Parts via BOM
                  </button>
                </Link>
              </div>
            </div>

            {/* Summary card */}
            <div className="rounded-2xl p-5"
              style={{ background: C.surface, backdropFilter: 'blur(16px)', border: `1px solid ${C.border}` }}>
              <h3 className="text-sm font-semibold mb-4" style={{ color: C.text }}>Monitor Summary</h3>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Total monitored', value: parts.length },
                  { label: 'Active alerts',   value: activeCount,   accent: C.green },
                  { label: 'Paused',          value: inactiveCount, accent: C.warn },
                ].map(({ label, value, accent }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: C.muted }}>{label}</span>
                    <span className="text-sm font-semibold" style={{ color: accent ?? C.text }}>
                      {isLoading ? '—' : value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Stat strip — echoes landing page "140+ / 10+ / 98%" row */}
              <div className="mt-4 pt-4 grid grid-cols-3 gap-2 text-center"
                style={{ borderTop: `1px solid ${C.borderSubtle}` }}>
                {[
                  { num: '140+', label: 'Distributors' },
                  { num: '10+',  label: 'Beta users' },
                  { num: '98%',  label: 'Risk coverage' },
                ].map(({ num, label }) => (
                  <div key={label}>
                    <p className="text-lg font-bold" style={{ color: C.green, fontFamily: "'Syne', sans-serif" }}>{num}</p>
                    <p className="text-xs mt-0.5" style={{ color: C.mutedDim }}>{label}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
