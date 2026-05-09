'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Eye, AlertTriangle, Package, RefreshCw, Trash2,
  Loader2, Search, ToggleLeft, ToggleRight, Upload
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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

// ─── Glacier style constants ──────────────────────────────────────────────────

const G = {
  panel:    'rounded-xl border' as const,
  elevated: 'rounded-xl border' as const,
  input:    'rounded-full border px-4 py-2 text-sm outline-none transition-all' as const,
  btnGhost: 'rounded-lg border px-4 py-2 text-sm font-medium transition-all flex items-center gap-2' as const,
  btnPrimary: 'rounded-lg px-5 py-2.5 text-sm font-semibold transition-all flex items-center gap-2' as const,
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardMonitorPage() {
  const [parts, setParts] = useState<MonitoredPart[]>([])
  const [fetchState, setFetchState] = useState<FetchState>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────

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

  // ── Toggle ─────────────────────────────────────────────────────────────────

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

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function deletePart(id: string) {
    setDeletingId(id)
    const { error } = await supabase.from('monitored_parts').delete().eq('id', id)
    if (!error) setParts(prev => prev.filter(p => p.id !== id))
    setDeletingId(null)
  }

  // ── Filter ─────────────────────────────────────────────────────────────────

  const filtered = parts.filter(p => {
    const q = searchTerm.toLowerCase()
    return p.mpn.toLowerCase().includes(q) || p.part_name.toLowerCase().includes(q)
  })

  const activeCount   = parts.filter(p => p.is_active).length
  const inactiveCount = parts.length - activeCount
  const isLoading     = fetchState === 'loading'

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-full" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Ambient glows ── */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute left-1/4 top-0 h-96 w-96 rounded-full blur-[120px]"
          style={{ background: 'radial-gradient(circle, rgba(125,211,252,0.06), transparent 70%)' }} />
        <div className="absolute bottom-1/4 right-1/4 h-[500px] w-[500px] rounded-full blur-[150px]"
          style={{ background: 'radial-gradient(circle, rgba(200,160,240,0.04), transparent 70%)' }} />
      </div>

      <div className="relative z-10 flex flex-col gap-8">

        {/* ── Page header ── */}
        <div>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#e0e8f0' }}>
                Monitoring <span style={{ color: '#7dd3fc' }}>&amp;</span> Market Alerts
              </h1>
              <p className="mt-2 text-sm" style={{ color: '#a0b4c4' }}>
                Real-time volatility, component telemetry, and anomaly feeds.
              </p>
            </div>
            <button
              onClick={fetchParts}
              disabled={isLoading}
              className={G.btnGhost}
              style={{
                background: 'rgba(15,21,36,0.6)',
                border: '1px solid rgba(125,211,252,0.15)',
                color: '#a0b4c4',
              }}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── Market Pulse cards ── */}
        <div>
          <h2 className="mb-4 text-xl font-semibold" style={{ color: '#e0e8f0' }}>Market Pulse</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">

            {/* Total Parts */}
            <div className={G.panel} style={{
              background: 'rgba(15,21,36,0.6)',
              borderColor: 'rgba(125,211,252,0.1)',
              backdropFilter: 'blur(16px)',
            }}>
              <div className="flex flex-col gap-3 p-6">
                <div className="flex items-start justify-between">
                  <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#a0b4c4' }}>
                    Total Parts
                  </p>
                  <span className="material-symbols-outlined" style={{ color: '#7dd3fc', fontSize: '20px' }}>
                    monitoring
                  </span>
                </div>
                <p className="text-4xl font-bold leading-tight" style={{ color: '#e0e8f0' }}>
                  {isLoading ? '—' : parts.length}
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="flex items-center gap-1 font-medium" style={{ color: '#7dd3fc' }}>
                    <Eye className="w-3.5 h-3.5" /> Watching
                  </span>
                  <span style={{ color: '#a0b4c4' }}>all components</span>
                </div>
              </div>
            </div>

            {/* Active */}
            <div className={G.panel} style={{
              background: 'rgba(15,21,36,0.6)',
              borderColor: 'rgba(125,211,252,0.1)',
              backdropFilter: 'blur(16px)',
            }}>
              <div className="flex flex-col gap-3 p-6">
                <div className="flex items-start justify-between">
                  <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#a0b4c4' }}>
                    Active Monitors
                  </p>
                  <span className="material-symbols-outlined" style={{ color: '#7dd3fc', fontSize: '20px' }}>
                    trending_up
                  </span>
                </div>
                <p className="text-4xl font-bold leading-tight" style={{ color: '#e0e8f0' }}>
                  {isLoading ? '—' : activeCount}
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="flex items-center gap-1 font-medium" style={{ color: '#7dd3fc' }}>
                    <Package className="w-3.5 h-3.5" /> Live
                  </span>
                  <span style={{ color: '#a0b4c4' }}>monitoring now</span>
                </div>
              </div>
            </div>

            {/* Inactive */}
            <div className={G.panel} style={{
              background: 'rgba(15,21,36,0.6)',
              borderColor: 'rgba(125,211,252,0.1)',
              backdropFilter: 'blur(16px)',
            }}>
              <div className="flex flex-col gap-3 p-6">
                <div className="flex items-start justify-between">
                  <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#a0b4c4' }}>
                    Inactive
                  </p>
                  <span className="material-symbols-outlined" style={{ color: '#c8a0f0', fontSize: '20px' }}>
                    pause_circle
                  </span>
                </div>
                <p className="text-4xl font-bold leading-tight" style={{ color: '#e0e8f0' }}>
                  {isLoading ? '—' : inactiveCount}
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <span className="flex items-center gap-1 font-medium" style={{ color: '#c8a0f0' }}>
                    <AlertTriangle className="w-3.5 h-3.5" /> Paused
                  </span>
                  <span style={{ color: '#a0b4c4' }}>not alerting</span>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ── Main table section ── */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* Table — 2/3 width */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold" style={{ color: '#e0e8f0' }}>Live Telemetry Feed</h2>
              {/* Search */}
              <div className="flex items-center gap-2 rounded-full px-4 py-2"
                style={{ background: 'rgba(15,21,36,0.4)', border: '1px solid rgba(125,211,252,0.1)', width: '220px' }}>
                <Search className="w-4 h-4 shrink-0" style={{ color: '#a0b4c4' }} />
                <input
                  placeholder="Search MPN or name…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  disabled={isLoading}
                  className="bg-transparent text-sm outline-none w-full placeholder:text-on-surface-variant"
                  style={{ color: '#e0e8f0' }}
                />
              </div>
            </div>

            {/* Table card */}
            <div className="overflow-hidden" style={{
              background: 'rgba(15,21,36,0.6)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(125,211,252,0.1)',
              borderRadius: '0.75rem',
            }}>
              {/* Loading */}
              {isLoading && (
                <div className="flex items-center justify-center gap-3 py-20" style={{ color: '#a0b4c4' }}>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Loading telemetry…</span>
                </div>
              )}

              {/* Error */}
              {fetchState === 'error' && (
                <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
                  <AlertTriangle className="w-8 h-8" style={{ color: '#ff6b6b' }} />
                  <p className="font-medium" style={{ color: '#e0e8f0' }}>Failed to load parts</p>
                  <p className="text-sm" style={{ color: '#a0b4c4' }}>{errorMessage}</p>
                  <button onClick={fetchParts} className={G.btnGhost}
                    style={{ background: 'rgba(26,36,56,0.5)', border: '1px solid rgba(160,180,196,0.2)', color: '#a0b4c4' }}>
                    Try again
                  </button>
                </div>
              )}

              {/* Empty */}
              {fetchState === 'success' && parts.length === 0 && (
                <div className="flex flex-col items-center gap-4 px-6 py-20 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl"
                    style={{ background: 'rgba(125,211,252,0.1)', border: '1px solid rgba(125,211,252,0.2)' }}>
                    <Package className="w-7 h-7" style={{ color: '#7dd3fc' }} />
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: '#e0e8f0' }}>No components monitored yet</p>
                    <p className="mt-1 text-sm" style={{ color: '#a0b4c4' }}>Upload a BOM to start tracking.</p>
                  </div>
                  <Link href="/dashboard/bom">
                    <button className={G.btnGhost}
                      style={{ background: 'rgba(125,211,252,0.15)', border: '1px solid rgba(125,211,252,0.3)', color: '#7dd3fc' }}>
                      <Upload className="w-4 h-4" />
                      Upload BOM
                    </button>
                  </Link>
                </div>
              )}

              {/* Table */}
              {fetchState === 'success' && parts.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(125,211,252,0.1)', background: 'rgba(10,14,26,0.5)' }}>
                        {['Timestamp', 'MPN / Component', 'Quantity', 'Metric', 'Status', ''].map(h => (
                          <th key={h} className="px-5 py-3.5 text-xs font-semibold uppercase tracking-wider"
                            style={{ color: '#a0b4c4' }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-5 py-12 text-center text-sm" style={{ color: '#a0b4c4' }}>
                            No parts match &ldquo;{searchTerm}&rdquo;
                          </td>
                        </tr>
                      ) : filtered.map(part => (
                        <tr key={part.id}
                          className="transition-colors"
                          style={{
                            borderBottom: '1px solid rgba(125,211,252,0.06)',
                            opacity: part.is_active ? 1 : 0.5,
                          }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(125,211,252,0.03)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                        >
                          {/* Timestamp */}
                          <td className="px-5 py-4 font-mono text-sm" style={{ color: '#a0b4c4' }}>
                            {new Date(part.created_at).toLocaleDateString(undefined, {
                              month: 'short', day: 'numeric'
                            })}
                          </td>

                          {/* MPN */}
                          <td className="px-5 py-4">
                            <p className="font-medium font-mono text-sm" style={{ color: '#e0e8f0' }}>{part.mpn}</p>
                            <p className="text-xs mt-0.5" style={{ color: '#a0b4c4' }}>{part.part_name}</p>
                          </td>

                          {/* Qty */}
                          <td className="px-5 py-4 text-sm" style={{ color: '#a0b4c4' }}>{part.quantity}</td>

                          {/* Metric placeholder */}
                          <td className="px-5 py-4 text-sm" style={{ color: '#a0b4c4' }}>Live Stock</td>

                          {/* Status badge */}
                          <td className="px-5 py-4">
                            {part.is_active ? (
                              <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium"
                                style={{ background: 'rgba(125,211,252,0.15)', border: '1px solid rgba(125,211,252,0.3)', color: '#7dd3fc' }}>
                                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium"
                                style={{ background: 'rgba(26,36,56,0.6)', border: '1px solid rgba(160,180,196,0.15)', color: '#a0b4c4' }}>
                                Inactive
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-5 py-4">
                            <div className="flex items-center justify-end gap-1">
                              {/* Toggle */}
                              <button
                                disabled={togglingId === part.id}
                                onClick={() => toggleActive(part)}
                                title={part.is_active ? 'Deactivate' : 'Activate'}
                                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                                style={{ color: part.is_active ? '#7dd3fc' : '#a0b4c4' }}
                                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(125,211,252,0.08)'}
                                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                              >
                                {togglingId === part.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : part.is_active ? (
                                  <ToggleRight className="w-4 h-4" />
                                ) : (
                                  <ToggleLeft className="w-4 h-4" />
                                )}
                              </button>

                              {/* Delete */}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <button
                                    disabled={deletingId === part.id}
                                    title="Delete"
                                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                                    style={{ color: '#a0b4c4' }}
                                    onMouseEnter={e => {
                                      (e.currentTarget as HTMLElement).style.background = 'rgba(255,107,107,0.08)';
                                      (e.currentTarget as HTMLElement).style.color = '#ff6b6b';
                                    }}
                                    onMouseLeave={e => {
                                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                                      (e.currentTarget as HTMLElement).style.color = '#a0b4c4';
                                    }}
                                  >
                                    {deletingId === part.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4" />
                                    )}
                                  </button>
                                </AlertDialogTrigger>
                                <AlertDialogContent style={{
                                  background: 'rgba(15,21,36,0.95)',
                                  border: '1px solid rgba(125,211,252,0.15)',
                                  backdropFilter: 'blur(24px)',
                                }}>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle style={{ color: '#e0e8f0' }}>Remove part?</AlertDialogTitle>
                                    <AlertDialogDescription style={{ color: '#a0b4c4' }}>
                                      <span className="font-mono font-medium" style={{ color: '#7dd3fc' }}>{part.mpn}</span>
                                      {' '}will be removed from your monitored parts. This cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel style={{
                                      background: 'rgba(26,36,56,0.5)',
                                      border: '1px solid rgba(160,180,196,0.2)',
                                      color: '#a0b4c4',
                                    }}>
                                      Cancel
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deletePart(part.id)}
                                      style={{ background: 'rgba(255,107,107,0.2)', border: '1px solid rgba(255,107,107,0.3)', color: '#ff6b6b' }}
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

          {/* ── AI Anomaly Analysis sidebar ── */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ color: '#c8a0f0', fontSize: '22px' }}>memory</span>
              <h2 className="text-xl font-semibold" style={{ color: '#e0e8f0' }}>AI Anomaly Analysis</h2>
            </div>

            <div style={{
              background: 'rgba(15,21,36,0.75)',
              backdropFilter: 'blur(24px)',
              border: '1px solid rgba(125,211,252,0.15)',
              borderTop: '2px solid #c8a0f0',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
            }}>
              {/* Critical risk block */}
              <div className="rounded-lg p-4" style={{
                background: 'rgba(61,20,20,0.3)',
                border: '1px solid rgba(255,107,107,0.3)',
              }}>
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined mt-0.5 shrink-0" style={{ color: '#ff6b6b', fontSize: '18px' }}>warning</span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#e0e8f0' }}>Critical Risk Detected</p>
                    <p className="mt-1 text-xs leading-relaxed" style={{ color: '#ffb3b3' }}>
                      {parts.filter(p => p.is_active).length === 0
                        ? 'No active monitors. Enable parts to detect risks.'
                        : `${activeCount} part${activeCount !== 1 ? 's' : ''} under active surveillance. Anomaly detection running.`}
                    </p>
                  </div>
                </div>
              </div>

              {/* Pattern anomaly block */}
              <div className="rounded-lg p-4" style={{
                background: 'rgba(26,36,56,0.4)',
                border: '1px solid rgba(125,211,252,0.1)',
              }}>
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined mt-0.5 shrink-0" style={{ color: '#c8a0f0', fontSize: '18px' }}>insights</span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#e0e8f0' }}>Pattern Anomaly</p>
                    <p className="mt-1 text-xs leading-relaxed" style={{ color: '#a0b4c4' }}>
                      {inactiveCount > 0
                        ? `${inactiveCount} inactive monitor${inactiveCount !== 1 ? 's' : ''} — re-enable to resume full telemetry coverage.`
                        : 'All monitors active. Watching for unusual purchasing patterns across suppliers.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Quick actions */}
              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={fetchParts}
                  disabled={isLoading}
                  className="w-full rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-all"
                  style={{
                    background: 'rgba(125,211,252,0.15)',
                    border: '1px solid rgba(125,211,252,0.3)',
                    color: '#7dd3fc',
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(125,211,252,0.25)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(125,211,252,0.15)'}
                >
                  <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  Run Telemetry Check
                </button>
                <Link href="/dashboard/bom" className="w-full">
                  <button className="w-full rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-2 transition-all"
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(200,160,240,0.25)',
                      color: '#c8a0f0',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(200,160,240,0.08)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <Upload className="w-4 h-4" />
                    Add Parts via BOM
                  </button>
                </Link>
              </div>
            </div>

            {/* Stats mini card */}
            <div style={{
              background: 'rgba(15,21,36,0.6)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(125,211,252,0.1)',
              borderRadius: '0.75rem',
              padding: '1.25rem',
            }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: '#e0e8f0' }}>Monitor Summary</h3>
              <div className="flex flex-col gap-3">
                {[
                  { label: 'Total monitored', value: parts.length },
                  { label: 'Active alerts', value: activeCount },
                  { label: 'Paused', value: inactiveCount },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: '#a0b4c4' }}>{label}</span>
                    <span className="text-sm font-semibold" style={{ color: '#e0e8f0' }}>
                      {isLoading ? '—' : value}
                    </span>
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