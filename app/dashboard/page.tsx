'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, AlertCircle, Zap, Plus, Trash2, Loader2, Eye, LayoutGrid } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ─── Steel Gray + Sky Blue tokens ───────────────────────────────────────────
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

function StatsCard({ label, value, icon, subtitle, accent }: {
  label: string; value: string | number; icon: React.ReactNode; subtitle?: string; accent?: string
}) {
  return (
    <div style={{ background: C.card, border: `1.5px solid ${C.cardBorder}`, boxShadow: C.cardShadow, borderRadius: 20, padding: 22 }}>
      <div style={{ width: 38, height: 38, borderRadius: 12, background: C.greenSoft, border: `1px solid ${C.greenBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        {icon}
      </div>
      <p style={{ fontSize: 10.5, fontWeight: 700, color: C.mutedLight, textTransform: 'uppercase', letterSpacing: '1.2px', marginBottom: 6 }}>{label}</p>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, color: accent ?? C.green, letterSpacing: '-1px', lineHeight: 1 }}>{value}</p>
      {subtitle && <p style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>{subtitle}</p>}
    </div>
  )
}

function WatchlistCard() {
  const [items, setItems]           = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [input, setInput]           = useState('')
  const [adding, setAdding]         = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  useEffect(() => { fetchWatchlist() }, [])

  async function fetchWatchlist() {
    setLoading(true)
    const { data } = await supabase.from('watchlist').select('*').order('added_at', { ascending: false })
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
    <div style={{ background: C.card, border: `1.5px solid ${C.cardBorder}`, boxShadow: C.cardShadow, borderRadius: 24, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: `1.5px solid ${C.divider}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Eye className="w-4 h-4" style={{ color: C.green }} />
          <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Watchlist</span>
          {!loading && (
            <span style={{ fontSize: 11, fontWeight: 700, background: C.greenSoft, color: C.green, border: `1px solid ${C.greenBorder}`, borderRadius: 50, padding: '1px 8px' }}>
              {items.length}
            </span>
          )}
        </div>
        <span style={{ fontSize: 11, color: C.mutedLight, fontWeight: 600 }}>Tracked MPNs</span>
      </div>

      {/* Input */}
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.divider}` }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem()}
            placeholder="Add MPN e.g. ESP32-WROOM-32"
            style={{
              flex: 1,
              background: C.bg,
              border: `1.5px solid ${C.cardBorder}`,
              boxShadow: C.shadowInner,
              borderRadius: 12,
              padding: '8px 14px',
              fontSize: 13,
              color: C.text,
              outline: 'none',
              transition: 'all 0.15s'
            }}
          />
          <button
            onClick={addItem}
            disabled={!input.trim() || adding}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '8px 18px', borderRadius: 50, fontSize: 12.5, fontWeight: 700,
              background: input.trim() ? C.green : C.greenSoft,
              border: 'none',
              color: input.trim() ? C.bg : C.muted,
              boxShadow: input.trim() ? '2px 2px 5px rgba(0, 0, 0, 0.2)' : 'none',
              cursor: input.trim() && !adding ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
            }}
          >
            {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Add
          </button>
        </div>
      </div>

      {/* List */}
      <div style={{ overflowY: 'auto', flex: 1, maxHeight: 260 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '36px 0', color: C.muted }}>
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: C.green }} />
            <span style={{ fontSize: 13 }}>Loading watchlist…</span>
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: '36px 0', textAlign: 'center', fontSize: 13, color: C.mutedLight }}>
            No items yet — add an MPN above.
          </div>
        ) : (
          <div>
            {items.map(item => (
              <div
                key={item.id}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: `1px solid ${C.divider}`, cursor: 'default', transition: 'background 0.12s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = C.rowHover}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, boxShadow: `0 0 6px ${C.green}`, display: 'inline-block' }} />
                  <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: C.text }}>{item.mpn}</span>
                  {item.label && item.label !== item.mpn && (
                    <span style={{ fontSize: 12, color: C.muted }}>{item.label}</span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {item.last_checked_at && (
                    <span style={{ fontSize: 11, color: C.mutedLight }}>{new Date(item.last_checked_at).toLocaleDateString()}</span>
                  )}
                  <button
                    onClick={() => removeItem(item.mpn, item.id)}
                    disabled={removingId === item.id}
                    style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, background: 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.12s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.dangerSoft; (e.currentTarget as HTMLElement).style.color = C.danger; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = C.muted; }}
                  >
                    {removingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

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
        const { data: alertsData }    = await supabase.from('alerts').select('*').order('created_at', { ascending: false }).limit(5)
        const { data: monitoredData } = await supabase.from('monitored_parts').select('*').order('created_at', { ascending: false }).limit(5)
        const { count: partsCount }   = await supabase.from('monitored_parts').select('*', { count: 'exact', head: true })
        const { count: alertCount }   = await supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('is_read', false)
        const today = new Date().toISOString().split('T')[0]
        const { count: apiCallCount } = await supabase.from('api_call_log').select('*', { count: 'exact', head: true }).gte('called_at', today)
        setAlerts(alertsData || [])
        setMonitored(monitoredData || [])
        setStats({ monitored: partsCount || 0, activeAlerts: alertCount || 0, apiCalls: apiCallCount || 0 })
      } catch { setError('Failed to load dashboard data') }
      finally { setIsLoading(false) }
    }
    fetchData()
  }, [])

  if (isLoading) return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, color: C.green, marginBottom: 6 }}>Dashboard</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.muted, marginTop: 12 }}>
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: C.green }} />
        <span style={{ fontSize: 14.5 }}>Syncing telemetry profiles…</span>
      </div>
    </div>
  )

  if (error) return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, color: C.green, marginBottom: 16 }}>Dashboard</h1>
      <div style={{ background: C.dangerSoft, border: `1.5px solid ${C.dangerBorder}`, borderRadius: 18, padding: 20 }}>
        <p style={{ color: C.danger, fontWeight: 600 }}>{error}</p>
      </div>
    </div>
  )

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column', gap: 24, position: 'relative' }}>

      {/* ─── Bento Row 1: Header Banner (Spans Full Width) ─── */}
      <div style={{ background: C.card, border: `1.5px solid ${C.cardBorder}`, boxShadow: C.cardShadow, borderRadius: 24, padding: '28px 32px' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: '1.5px', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
          Procurement Telemetry Snap
        </span>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, color: C.text, letterSpacing: '-1px', margin: 0 }}>
          Dashboard Overview
        </h1>
        <p style={{ marginTop: 6, fontSize: 14.5, color: C.muted, lineHeight: 1.6, maxWidth: 650 }}>
          Live feed from distributor networks and AI sourcing agents. Review active supply chain risks below.
        </p>
      </div>

      {/* ─── Bento Row 2: Grid of Stats (3 Columns) ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatsCard label="Monitored Components" value={stats.monitored} icon={<LayoutGrid className="w-4 h-4" style={{ color: C.green }} />} subtitle="Across all uploaded BOMs" />
        <StatsCard label="Active Alerts" value={stats.activeAlerts} icon={<AlertCircle className="w-4 h-4" style={{ color: stats.activeAlerts > 0 ? C.danger : C.green }} />} subtitle="Awaiting action" accent={stats.activeAlerts > 0 ? C.danger : undefined} />
        <StatsCard label="API Queries Today" value={stats.apiCalls} icon={<Zap className="w-4 h-4" style={{ color: C.green }} />} subtitle="Live distributor checks" />
      </div>

      {/* ─── Bento Row 3: Watchlist + Alerts (2 Columns) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Watchlist Section - Bento Col 7 */}
        <div className="lg:col-span-7" style={{ display: 'flex' }}>
          <div style={{ flex: 1 }}>
            <WatchlistCard />
          </div>
        </div>

        {/* Recent Alerts Section - Bento Col 5 */}
        <div className="lg:col-span-5" style={{ background: C.card, border: `1.5px solid ${C.cardBorder}`, boxShadow: C.cardShadow, borderRadius: 24, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 20px', borderBottom: `1.5px solid ${C.divider}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle className="w-4 h-4" style={{ color: C.warn }} />
            <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Recent Warnings</span>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', maxHeight: 310 }}>
            {alerts.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', fontSize: 13, color: C.mutedLight }}>
                No active warnings. Sourcing routes are healthy.
              </div>
            ) : alerts.map(alert => (
              <div
                key={alert.id}
                style={{ padding: '14px 20px', borderBottom: `1px solid ${C.divider}`, transition: 'background 0.12s', cursor: 'default' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = C.rowHover}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: C.text }}>{alert.mpn}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 4,
                        ...(alert.urgency === 'high'
                          ? { background: C.dangerSoft, color: C.danger, border: `1px solid ${C.dangerBorder}` }
                          : alert.urgency === 'medium'
                          ? { background: C.warnSoft, color: C.warn, border: `1px solid ${C.warnBorder}` }
                          : { background: C.greenSoft, color: C.green, border: `1px solid ${C.greenBorder}` })
                      }}>
                        {alert.urgency === 'high' && <AlertTriangle size={9} />}
                        {alert.urgency}
                      </span>
                    </div>
                    <p style={{ fontSize: 12.5, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{alert.summary}</p>
                  </div>
                  <span style={{ fontSize: 11, color: C.mutedLight, flexShrink: 0, fontWeight: 600 }}>
                    {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Bento Row 4: Monitored Components Table (Full Width) ─── */}
      <div style={{ background: C.card, border: `1.5px solid ${C.cardBorder}`, boxShadow: C.cardShadow, borderRadius: 24, overflow: 'hidden' }}>
        <div style={{ padding: '18px 24px', borderBottom: `1.5px solid ${C.divider}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: C.sky }}>Live Telemetry Feeds</span>
          <span style={{ fontSize: 11.5, color: C.muted }}>Top monitored items</span>
        </div>
        {monitored.length === 0 ? (
          <div style={{ padding: '48px 20px', textAlign: 'center', fontSize: 13, color: C.mutedLight }}>
            No components monitored yet —{' '}
            <a href="/dashboard/chat" style={{ color: C.green, textDecoration: 'underline', fontWeight: 600 }}>upload a BOM in Chat</a> to begin.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: C.bg, borderBottom: `1px solid ${C.divider}` }}>
                  {['MPN', 'Name / Description', 'Monitored Quantity', 'Telemetry Status'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-left" style={{ color: C.muted, letterSpacing: '0.08em' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monitored.map(item => (
                  <tr
                    key={item.id}
                    style={{ borderBottom: `1px solid ${C.divider}`, transition: 'all 0.12s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = C.rowHover}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <td className="px-5 py-4 font-mono font-bold" style={{ color: C.text }}>
                      {item.mpn}
                    </td>
                    <td className="px-5 py-4" style={{ color: C.muted }}>
                      {item.part_name || 'Generic component'}
                    </td>
                    <td className="px-5 py-4 font-semibold" style={{ color: C.text }}>
                      {item.quantity} units
                    </td>
                    <td className="px-5 py-4">
                      <span style={{
                        fontSize: 10.5, fontWeight: 700, padding: '3px 10px', borderRadius: 12,
                        ...(item.is_active
                          ? { background: 'rgba(16, 185, 129, 0.12)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }
                          : { background: C.greenSoft, color: C.muted, border: `1px solid ${C.cardBorder}` })
                      }}>
                        {item.is_active ? 'ACTIVE WATCH' : 'PAUSED'}
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
