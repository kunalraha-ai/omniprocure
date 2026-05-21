'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, AlertCircle, Zap, Plus, Trash2, Loader2, Eye } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ── Design tokens matching landing page ───────────────────────────────────────
const C = {
  green:      '#1b7a52',
  greenSoft:  'rgba(27,122,82,0.15)',
  greenBorder:'rgba(27,122,82,0.25)',
  text:       '#dff0e8',
  muted:      '#7aaa8e',
  mutedDim:   '#3e6b52',
  surface:    'rgba(7,26,16,0.55)',
  border:     'rgba(27,122,82,0.18)',
  warn:       '#d97706',
  warnSoft:   'rgba(120,80,10,0.2)',
  danger:     '#f87171',
  dangerSoft: 'rgba(100,20,20,0.2)',
}

function StatsCard({ label, value, icon, subtitle, accent }: {
  label: string
  value: string | number
  icon: React.ReactNode
  subtitle?: string
  accent?: string
}) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3"
      style={{ background: C.surface, border: `1px solid ${C.border}`, backdropFilter: 'blur(16px)' }}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: C.greenSoft, border: `1px solid ${C.greenBorder}` }}
        >
          {icon}
        </div>
      </div>
      <div>
        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: C.mutedDim, letterSpacing: '0.14em' }}>{label}</p>
        <p className="text-3xl font-bold" style={{ color: accent ?? C.text, fontFamily: "'Syne', sans-serif" }}>{value}</p>
        {subtitle && <p className="text-xs mt-1" style={{ color: C.muted }}>{subtitle}</p>}
      </div>
    </div>
  )
}

// ── Watchlist Card ────────────────────────────────────────────────────────────
function WatchlistCard() {
  const [items, setItems]           = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [input, setInput]           = useState('')
  const [adding, setAdding]         = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  useEffect(() => { fetchWatchlist() }, [])

  async function fetchWatchlist() {
    setLoading(true)
    const { data } = await supabase
      .from('watchlist')
      .select('*')
      .order('added_at', { ascending: false })
    setItems(data ?? [])
    setLoading(false)
  }

  async function addItem() {
    const mpn = input.trim().toUpperCase()
    if (!mpn || adding) return
    setAdding(true)
    const { error } = await supabase.from('watchlist').upsert(
      { mpn, label: mpn, added_at: new Date().toISOString() },
      { onConflict: 'mpn' }
    )
    if (!error) { setInput(''); await fetchWatchlist() }
    setAdding(false)
  }

  async function removeItem(mpn: string, id: string) {
    setRemovingId(id)
    await supabase.from('watchlist').delete().eq('mpn', mpn)
    setItems(prev => prev.filter(i => i.id !== id))
    setRemovingId(null)
  }

  return (
    <div
      className="rounded-2xl overflow-hidden flex flex-col"
      style={{ background: C.surface, border: `1px solid ${C.border}`, backdropFilter: 'blur(16px)' }}
    >
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${C.border}` }}
      >
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4" style={{ color: C.green }} />
          <h2 className="text-sm font-semibold" style={{ color: C.text }}>Watchlist</h2>
          {!loading && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: C.greenSoft, color: C.green, border: `1px solid ${C.greenBorder}` }}
            >
              {items.length}
            </span>
          )}
        </div>
        <span className="text-xs" style={{ color: C.mutedDim }}>Tracked MPNs</span>
      </div>

      {/* Add input */}
      <div className="px-5 py-3.5" style={{ borderBottom: `1px solid rgba(27,122,82,0.1)` }}>
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem()}
            placeholder="Add MPN e.g. ESP32-WROOM-32"
            className="flex-1 bg-transparent text-sm outline-none px-3 py-2 rounded-xl"
            style={{
              background: 'rgba(7,26,16,0.5)',
              border: `1px solid ${C.border}`,
              color: C.text,
            }}
          />
          <button
            onClick={addItem}
            disabled={!input.trim() || adding}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background: input.trim() ? C.greenSoft : 'rgba(27,122,82,0.05)',
              border: `1px solid ${input.trim() ? C.greenBorder : 'transparent'}`,
              color: input.trim() ? C.green : C.mutedDim,
              cursor: input.trim() && !adding ? 'pointer' : 'not-allowed',
            }}
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10" style={{ color: C.muted }}>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading…</span>
        </div>
      ) : items.length === 0 ? (
        <div className="py-10 text-center text-sm" style={{ color: C.mutedDim }}>
          No items yet — add an MPN above.
        </div>
      ) : (
        <div style={{ divide: 'rgba(27,122,82,0.08)' }}>
          {items.map(item => (
            <div
              key={item.id}
              className="flex items-center justify-between px-5 py-3 transition-colors"
              style={{ borderBottom: `1px solid rgba(27,122,82,0.07)` }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(27,122,82,0.05)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              <div className="flex items-center gap-3">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: C.green, boxShadow: `0 0 6px ${C.green}`, animation: 'pulse 2s infinite' }}
                />
                <span className="text-sm font-mono font-medium" style={{ color: C.text }}>{item.mpn}</span>
                {item.label && item.label !== item.mpn && (
                  <span className="text-xs" style={{ color: C.muted }}>{item.label}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {item.last_checked_at && (
                  <span className="text-xs hidden sm:block" style={{ color: C.mutedDim }}>
                    {new Date(item.last_checked_at).toLocaleDateString()}
                  </span>
                )}
                <button
                  onClick={() => removeItem(item.mpn, item.id)}
                  disabled={removingId === item.id}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                  style={{ color: C.mutedDim }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.color = '#f87171';
                    (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.08)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.color = C.mutedDim;
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }}
                >
                  {removingId === item.id
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Trash2 className="w-3.5 h-3.5" />
                  }
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [alerts, setAlerts]       = useState<any[]>([])
  const [monitored, setMonitored] = useState<any[]>([])
  const [stats, setStats]         = useState({ monitored: 0, activeAlerts: 0, apiCalls: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const { data: alertsData }   = await supabase.from('alerts').select('*').order('created_at', { ascending: false }).limit(5)
        const { data: monitoredData } = await supabase.from('monitored_parts').select('*').order('created_at', { ascending: false }).limit(5)
        const { count: partsCount }  = await supabase.from('monitored_parts').select('*', { count: 'exact', head: true })
        const { count: alertCount }  = await supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('is_read', false)
        const today = new Date().toISOString().split('T')[0]
        const { count: apiCallCount } = await supabase.from('api_call_log').select('*', { count: 'exact', head: true }).gte('called_at', today)

        setAlerts(alertsData || [])
        setMonitored(monitoredData || [])
        setStats({ monitored: partsCount || 0, activeAlerts: alertCount || 0, apiCalls: apiCallCount || 0 })
      } catch {
        setError('Failed to load dashboard data')
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  if (isLoading) return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-2" style={{ color: C.text, fontFamily: "'Syne', sans-serif" }}>Dashboard</h1>
      <p style={{ color: C.muted }}>Loading procurement overview…</p>
    </div>
  )

  if (error) return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4" style={{ color: C.text, fontFamily: "'Syne', sans-serif" }}>Dashboard</h1>
      <div className="rounded-2xl p-4" style={{ background: C.dangerSoft, border: '1px solid rgba(248,113,113,0.25)' }}>
        <p style={{ color: '#f87171' }}>{error}</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6" style={{ fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div
        className="rounded-2xl p-7"
        style={{ background: 'rgba(7,26,16,0.65)', border: `1px solid ${C.greenBorder}`, backdropFilter: 'blur(20px)' }}
      >
        <div className="flex items-center gap-3 mb-1">
          <div
            className="text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full"
            style={{ background: C.greenSoft, color: C.green, border: `1px solid ${C.greenBorder}`, letterSpacing: '0.12em' }}
          >
            Procurement Overview
          </div>
        </div>
        <h1 className="text-3xl font-bold mt-3" style={{ color: C.text, fontFamily: "'Syne', sans-serif" }}>
          Dashboard
        </h1>
        <p className="mt-1" style={{ color: C.muted, fontSize: 14 }}>
          Welcome back. Here's your live procurement snapshot.
        </p>
      </div>

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatsCard
          label="Monitored Components"
          value={stats.monitored}
          icon={<Zap className="w-4 h-4" style={{ color: C.green }} />}
          subtitle="Across all BOMs"
        />
        <StatsCard
          label="Active Alerts"
          value={stats.activeAlerts}
          icon={<AlertCircle className="w-4 h-4" style={{ color: C.warn }} />}
          subtitle="Requires action"
          accent={stats.activeAlerts > 0 ? C.warn : undefined}
        />
        <StatsCard
          label="API Calls Today"
          value={stats.apiCalls}
          icon={<Zap className="w-4 h-4" style={{ color: C.muted }} />}
          subtitle="Distributor queries"
        />
      </div>

      {/* ── Watchlist + Recent Alerts ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        <WatchlistCard />

        {/* Recent Alerts */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: C.surface, border: `1px solid ${C.border}`, backdropFilter: 'blur(16px)' }}
        >
          <div className="px-5 py-4 flex items-center gap-2" style={{ borderBottom: `1px solid ${C.border}` }}>
            <AlertCircle className="w-4 h-4" style={{ color: C.warn }} />
            <h2 className="text-sm font-semibold" style={{ color: C.text }}>Recent Alerts</h2>
          </div>
          {alerts.length === 0 ? (
            <div className="p-8 text-center text-sm" style={{ color: C.mutedDim }}>
              No alerts yet — OmniProcure will notify you when stock or price issues are detected.
            </div>
          ) : (
            <div>
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="px-5 py-4 transition-colors"
                  style={{ borderBottom: `1px solid rgba(27,122,82,0.07)` }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(27,122,82,0.04)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-mono font-medium" style={{ color: C.text }}>{alert.mpn}</span>
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={
                            alert.urgency === 'high'
                              ? { background: C.dangerSoft, color: C.danger, border: '1px solid rgba(248,113,113,0.25)' }
                              : alert.urgency === 'medium'
                              ? { background: C.warnSoft, color: C.warn, border: '1px solid rgba(217,119,6,0.25)' }
                              : { background: C.greenSoft, color: C.green, border: `1px solid ${C.greenBorder}` }
                          }
                        >
                          {alert.urgency === 'high' && <AlertTriangle size={9} />}
                          {alert.urgency}
                        </span>
                      </div>
                      <p className="text-xs truncate" style={{ color: C.muted }}>{alert.summary}</p>
                    </div>
                    <span className="text-xs whitespace-nowrap flex-shrink-0" style={{ color: C.mutedDim }}>
                      {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Monitored Components ─────────────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: C.surface, border: `1px solid ${C.border}`, backdropFilter: 'blur(16px)' }}
      >
        <div className="px-5 py-4" style={{ borderBottom: `1px solid ${C.border}` }}>
          <h2 className="text-sm font-semibold" style={{ color: C.text }}>Monitored Components</h2>
        </div>
        {monitored.length === 0 ? (
          <div className="p-8 text-center text-sm" style={{ color: C.mutedDim }}>
            No components monitored yet —{' '}
            <a href="/dashboard/bom" style={{ color: C.green, textDecoration: 'underline' }}>upload a BOM to get started</a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(7,26,16,0.6)' }}>
                  {['MPN', 'Part Name', 'Quantity', 'Status'].map(h => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left"
                      style={{ fontSize: 10.5, fontWeight: 700, color: C.mutedDim, letterSpacing: '0.1em', textTransform: 'uppercase', borderBottom: `1px solid ${C.border}` }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monitored.map((item) => (
                  <tr
                    key={item.id}
                    style={{ borderBottom: `1px solid rgba(27,122,82,0.07)` }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(27,122,82,0.04)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <td className="px-5 py-3.5 text-sm font-mono font-medium" style={{ color: C.text }}>{item.mpn}</td>
                    <td className="px-5 py-3.5 text-sm" style={{ color: C.muted }}>{item.part_name}</td>
                    <td className="px-5 py-3.5 text-sm" style={{ color: C.muted }}>{item.quantity}</td>
                    <td className="px-5 py-3.5">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                        style={
                          item.is_active
                            ? { background: C.greenSoft, color: C.green, border: `1px solid ${C.greenBorder}` }
                            : { background: 'rgba(7,26,16,0.5)', color: C.mutedDim, border: `1px solid ${C.border}` }
                        }
                      >
                        {item.is_active && (
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.green, animation: 'pulse 2s infinite' }} />
                        )}
                        {item.is_active ? 'Monitoring' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  )
}
