'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, AlertCircle, Zap, Plus, Trash2, Loader2, Eye } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ─── Light theme tokens (landing page) ───────────────────────────────────────
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
  divider:     '#f0f4f2',
  rowHover:    'rgba(27,122,82,0.03)',
  warn:        '#7a4f0a',
  warnSoft:    '#fef3e2',
  warnBorder:  'rgba(217,119,6,0.3)',
  danger:      '#7a1a0a',
  dangerSoft:  '#fdecea',
  dangerBorder:'rgba(248,113,113,0.3)',
}

function StatsCard({ label, value, icon, subtitle, accent }: {
  label: string; value: string | number; icon: React.ReactNode; subtitle?: string; accent?: string
}) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow, borderRadius: 18, padding: 22 }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: C.greenSoft, border: `1px solid ${C.greenBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
        {icon}
      </div>
      <p style={{ fontSize: 10.5, fontWeight: 700, color: C.mutedLight, textTransform: 'uppercase', letterSpacing: '1.1px', marginBottom: 4 }}>{label}</p>
      <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 30, fontWeight: 800, color: accent ?? C.text, letterSpacing: '-1px', lineHeight: 1 }}>{value}</p>
      {subtitle && <p style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{subtitle}</p>}
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
    <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow, borderRadius: 18, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.divider}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Eye className="w-4 h-4" style={{ color: C.green }} />
          <span style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>Watchlist</span>
          {!loading && (
            <span style={{ fontSize: 11, fontWeight: 700, background: C.greenSoft, color: C.green, border: `1px solid ${C.greenBorder}`, borderRadius: 50, padding: '1px 8px' }}>
              {items.length}
            </span>
          )}
        </div>
        <span style={{ fontSize: 11, color: C.mutedLight }}>Tracked MPNs</span>
      </div>

      {/* Input */}
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${C.divider}` }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem()}
            placeholder="Add MPN e.g. ESP32-WROOM-32"
            style={{ flex: 1, background: C.greenSoft, border: `1px solid ${C.greenBorder}`, borderRadius: 10, padding: '8px 12px', fontSize: 13, color: C.text, outline: 'none' }}
          />
          <button
            onClick={addItem}
            disabled={!input.trim() || adding}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '8px 14px', borderRadius: 50, fontSize: 12.5, fontWeight: 600,
              background: input.trim() ? C.text : C.greenSoft,
              border: `1px solid ${input.trim() ? C.text : C.greenBorder}`,
              color: input.trim() ? '#dff0e8' : C.mutedLight,
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
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '32px 0', color: C.muted }}>
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: C.green }} />
          <span style={{ fontSize: 13 }}>Loading…</span>
        </div>
      ) : items.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', fontSize: 13, color: C.mutedLight }}>
          No items yet — add an MPN above.
        </div>
      ) : (
        <div>
          {items.map(item => (
            <div
              key={item.id}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 20px', borderBottom: `1px solid ${C.divider}`, cursor: 'default', transition: 'background 0.12s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = C.rowHover}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, boxShadow: `0 0 5px ${C.green}55`, display: 'inline-block' }} />
                <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 600, color: C.text }}>{item.mpn}</span>
                {item.label && item.label !== item.mpn && (
                  <span style={{ fontSize: 12, color: C.mutedLight }}>{item.label}</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {item.last_checked_at && (
                  <span style={{ fontSize: 11, color: C.mutedLight }}>{new Date(item.last_checked_at).toLocaleDateString()}</span>
                )}
                <button
                  onClick={() => removeItem(item.mpn, item.id)}
                  disabled={removingId === item.id}
                  style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.mutedLight, background: 'transparent', border: 'none', cursor: 'pointer', transition: 'all 0.12s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.dangerSoft; (e.currentTarget as HTMLElement).style.color = C.danger; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = C.mutedLight; }}
                >
                  {removingId === item.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
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
    <div>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, color: C.text, marginBottom: 6 }}>Dashboard</h1>
      <p style={{ color: C.muted, fontSize: 14 }}>Loading procurement overview…</p>
    </div>
  )

  if (error) return (
    <div>
      <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, color: C.text, marginBottom: 16 }}>Dashboard</h1>
      <div style={{ background: C.dangerSoft, border: `1px solid ${C.dangerBorder}`, borderRadius: 14, padding: 16 }}>
        <p style={{ color: C.danger }}>{error}</p>
      </div>
    </div>
  )

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Header banner ── */}
      <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow, borderRadius: 18, padding: '24px 28px' }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: C.greenDark, letterSpacing: '1.2px', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>
          Procurement Overview
        </span>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, color: C.text, letterSpacing: '-1px', lineHeight: 1.1, margin: 0 }}>
          Dashboard
        </h1>
        <p style={{ marginTop: 6, fontSize: 14, color: C.muted, lineHeight: 1.6 }}>
          Welcome back. Here&apos;s your live procurement snapshot.
        </p>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatsCard label="Monitored Components" value={stats.monitored} icon={<Zap className="w-4 h-4" style={{ color: C.green }} />} subtitle="Across all BOMs" />
        <StatsCard label="Active Alerts" value={stats.activeAlerts} icon={<AlertCircle className="w-4 h-4" style={{ color: C.warn }} />} subtitle="Requires action" accent={stats.activeAlerts > 0 ? C.warn : undefined} />
        <StatsCard label="API Calls Today" value={stats.apiCalls} icon={<Zap className="w-4 h-4" style={{ color: C.muted }} />} subtitle="Distributor queries" />
      </div>

      {/* ── Watchlist + Alerts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <WatchlistCard />

        {/* Recent Alerts */}
        <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow, borderRadius: 18, overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.divider}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle className="w-4 h-4" style={{ color: C.warn }} />
            <span style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>Recent Alerts</span>
          </div>
          {alerts.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center', fontSize: 13, color: C.mutedLight }}>
              No alerts yet — OmniProcure will notify you when stock or price issues are detected.
            </div>
          ) : alerts.map(alert => (
            <div
              key={alert.id}
              style={{ padding: '12px 20px', borderBottom: `1px solid ${C.divider}`, transition: 'background 0.12s', cursor: 'default' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = C.rowHover}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontFamily: 'monospace', fontWeight: 600, color: C.text }}>{alert.mpn}</span>
                    <span style={{
                      fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 50, display: 'inline-flex', alignItems: 'center', gap: 4,
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
                  <p style={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{alert.summary}</p>
                </div>
                <span style={{ fontSize: 11, color: C.mutedLight, flexShrink: 0 }}>
                  {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Monitored Components table ── */}
      <div style={{ background: C.card, border: `1px solid ${C.cardBorder}`, boxShadow: C.cardShadow, borderRadius: 18, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.divider}` }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>Monitored Components</span>
        </div>
        {monitored.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', fontSize: 13, color: C.mutedLight }}>
            No components monitored yet —{' '}
            <a href="/dashboard/bom" style={{ color: C.green, textDecoration: 'underline' }}>upload a BOM to get started</a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f7fbf9' }}>
                  {['MPN', 'Part Name', 'Quantity', 'Status'].map(h => (
                    <th key={h} style={{ padding: '10px 20px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: C.mutedLight, letterSpacing: '1px', textTransform: 'uppercase', borderBottom: `1px solid ${C.divider}` }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monitored.map(item => (
                  <tr
                    key={item.id}
                    style={{ borderBottom: `1px solid ${C.divider}`, transition: 'background 0.12s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = C.rowHover}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px 20px', fontSize: 13, fontFamily: 'monospace', fontWeight: 600, color: C.text }}>{item.mpn}</td>
                    <td style={{ padding: '12px 20px', fontSize: 13, color: C.muted }}>{item.part_name}</td>
                    <td style={{ padding: '12px 20px', fontSize: 13, color: C.muted }}>{item.quantity}</td>
                    <td style={{ padding: '12px 20px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        padding: '3px 10px', borderRadius: 50, fontSize: 11.5, fontWeight: 600,
                        ...(item.is_active
                          ? { background: C.greenSoft, color: C.greenDark, border: `1px solid ${C.greenBorder}` }
                          : { background: 'rgba(10,34,24,0.05)', color: C.mutedLight, border: `1px solid ${C.cardBorder}` })
                      }}>
                        {item.is_active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.green }} />}
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
