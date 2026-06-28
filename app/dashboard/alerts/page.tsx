'use client'

import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, AlertCircle, Bell, BellOff, RefreshCw, Search, Loader2, Trash2, Check, CheckCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type Urgency = 'high' | 'medium' | 'low'
interface Alert { id: string; mpn: string; urgency: Urgency; summary: string; recommendation: string; is_read: boolean; created_at: string }
type FetchState = 'idle' | 'loading' | 'success' | 'error'
type TabFilter = 'all' | Urgency | 'unread'

// ─── Steel Gray + Sky Blue tokens ───────────────────────────────────────────
const C = {
  bg:          '#1c202a',
  sidebar:     '#232833',
  green:       '#5ebcf8', // Sky Blue
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

const TABS: { value: TabFilter; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }, { value: 'unread', label: 'Unread' },
]

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), d = Math.floor(diff / 86400000)
  if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`; if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  const styles: Record<Urgency, { bg: string; color: string; border: string }> = {
    high:   { bg: C.dangerSoft, color: C.danger, border: C.dangerBorder },
    medium: { bg: C.warnSoft,   color: C.warn,   border: C.warnBorder   },
    low:    { bg: C.greenSoft,  color: C.green, border: C.greenBorder },
  }
  const s = styles[urgency]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 50, fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {urgency === 'high' && <AlertTriangle size={9} />}
      {urgency === 'medium' && <AlertCircle size={9} />}
      {urgency}
    </span>
  )
}

export default function DashboardAlertsPage() {
  const [alerts, setAlerts]   = useState<Alert[]>([])
  const [fetchState, setFetchState] = useState<FetchState>('idle')
  const [errMsg, setErrMsg]   = useState('')
  const [search, setSearch]   = useState('')
  const [tab, setTab]         = useState<TabFilter>('all')
  const [mutatingId, setMutatingId] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)

  const fetchAlerts = useCallback(async () => {
    setFetchState('loading'); setErrMsg('')
    const { data, error } = await supabase.from('alerts').select('id,mpn,urgency,summary,recommendation,is_read,created_at').order('created_at', { ascending: false })
    if (error) { setErrMsg(error.message); setFetchState('error'); return }
    setAlerts(data ?? []); setFetchState('success')
  }, [])

  useEffect(() => { fetchAlerts() }, [fetchAlerts])

  async function markRead(id: string, value: boolean) {
    setMutatingId(id)
    const { error } = await supabase.from('alerts').update({ is_read: value }).eq('id', id)
    if (!error) setAlerts(p => p.map(a => a.id === id ? { ...a, is_read: value } : a))
    setMutatingId(null)
  }

  async function markAllRead() {
    setMarkingAll(true)
    const ids = alerts.filter(a => !a.is_read).map(a => a.id)
    if (ids.length) {
      const { error } = await supabase.from('alerts').update({ is_read: true }).in('id', ids)
      if (!error) setAlerts(p => p.map(a => ({ ...a, is_read: true })))
    }
    setMarkingAll(false)
  }

  async function deleteAlert(id: string) {
    setMutatingId(id)
    await supabase.from('alerts').delete().eq('id', id)
    setAlerts(p => p.filter(a => a.id !== id))
    setMutatingId(null)
  }

  const filtered = alerts.filter(a => {
    const q = search.toLowerCase()
    const matchSearch = a.mpn.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q)
    const matchTab = tab === 'all' ? true : tab === 'unread' ? !a.is_read : a.urgency === tab
    return matchSearch && matchTab
  })

  const tabCount = (t: TabFilter) => t === 'all' ? alerts.length : t === 'unread' ? alerts.filter(a => !a.is_read).length : alerts.filter(a => a.urgency === t).length
  const unread = alerts.filter(a => !a.is_read).length
  const high   = alerts.filter(a => a.urgency === 'high' && !a.is_read).length
  const isLoading = fetchState === 'loading'

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: C.text, display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Header */}
      <div style={{ background: C.card, border: `1.5px solid ${C.cardBorder}`, boxShadow: C.cardShadow, borderRadius: 24, padding: '28px 32px' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: C.green, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 8 }}>Active Sourcing Feeds</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, color: C.text, letterSpacing: '-1px', margin: 0 }}>Active Alerts</h1>
          {unread > 0 && (
            <span style={{ background: C.dangerSoft, color: C.danger, border: `1px solid ${C.dangerBorder}`, fontSize: 12, fontWeight: 700, padding: '2px 12px', borderRadius: 50 }}>{unread} unread</span>
          )}
        </div>
        <p style={{ marginTop: 6, fontSize: 14.5, color: C.muted }}>Review system alerts, single source warnings, and inventory anomalies.</p>

        {/* Bento metric blocks */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 24 }}>
          {[
            ['High Priority Warnings', isLoading ? '—' : String(high), C.danger, C.dangerSoft, C.dangerBorder],
            ['Unread Notifications', isLoading ? '—' : String(unread), C.warn, C.warnSoft, C.warnBorder],
            ['Cumulative Alerts', isLoading ? '—' : String(alerts.length), C.green, C.greenSoft, C.greenBorder]
          ].map(([label, val, color, bg, border]) => (
            <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 18, padding: '16px 20px', boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.1)' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>{label}</p>
              <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, color, letterSpacing: '-1px', marginTop: 8, marginBottom: 0, lineHeight: 1 }}>{val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TABS.map(t => {
            const active = tab === t.value
            return (
              <button key={t.value} onClick={() => setTab(t.value)} disabled={isLoading}
                className={active ? "" : "shadow-neu-raised-sm"}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '8px 16px', borderRadius: 50, fontSize: 13,
                  fontWeight: active ? 800 : 600, cursor: 'pointer', transition: 'all 0.15s',
                  background: active ? C.green : C.card,
                  color: active ? C.bg : C.muted,
                  border: active ? 'none' : `1px solid ${C.cardBorder}`,
                  boxShadow: active ? 'inset 2px 2px 4px rgba(0,0,0,0.2)' : undefined
                }}>
                {t.label}
                <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 50, background: active ? 'rgba(0,0,0,0.12)' : C.greenSoft, color: active ? C.bg : C.green }}>
                  {isLoading ? '—' : tabCount(t.value)}
                </span>
              </button>
            )
          })}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={markAllRead} disabled={isLoading || markingAll || unread === 0}
            className="shadow-neu-raised-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 50, fontSize: 13, fontWeight: 700, background: C.card, color: C.green, border: `1.5px solid ${C.cardBorder}`, cursor: unread > 0 ? 'pointer' : 'not-allowed', opacity: unread === 0 ? 0.5 : 1 }}>
            {markingAll ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />} Resolve all
          </button>
          <button onClick={fetchAlerts} disabled={isLoading}
            className="shadow-neu-raised-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 50, fontSize: 13, fontWeight: 700, background: C.card, color: C.green, border: `1.5px solid ${C.cardBorder}`, cursor: 'pointer' }}>
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: C.bg, border: `1.5px solid ${C.cardBorder}`, borderRadius: 50, padding: '9px 18px', width: 280, boxShadow: C.shadowInner }}>
        <Search size={15} style={{ color: C.mutedLight, flexShrink: 0 }} />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search MPN or summary…" disabled={isLoading}
          style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: C.text, width: '100%' }} />
      </div>

      {/* Table card */}
      <div style={{ background: C.card, border: `1.5px solid ${C.cardBorder}`, boxShadow: C.cardShadow, borderRadius: 24, overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1.5px solid ${C.divider}`, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bell size={16} style={{ color: C.green }} />
          <span style={{ fontSize: 14, fontWeight: 800, color: C.text }}>Inbox Warnings</span>
        </div>

        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '64px 0', color: C.muted }}>
            <Loader2 size={18} className="animate-spin" style={{ color: C.green }} />
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>Syncing alert logs…</span>
          </div>
        )}

        {fetchState === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '64px 20px', textAlign: 'center' }}>
            <AlertTriangle size={28} style={{ color: C.danger }} />
            <p style={{ fontWeight: 800, color: C.text, fontSize: 16 }}>Failed to load alerts</p>
            <p style={{ fontSize: 13, color: C.muted }}>{errMsg}</p>
            <button onClick={fetchAlerts} style={{ padding: '9px 20px', borderRadius: 50, fontSize: 13, fontWeight: 700, background: C.greenSoft, color: C.green, border: `1px solid ${C.greenBorder}`, cursor: 'pointer' }}>Try again</button>
          </div>
        )}

        {fetchState === 'success' && alerts.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '64px 20px', textAlign: 'center' }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: C.greenSoft, border: `1px solid ${C.greenBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={20} style={{ color: C.green }} />
            </div>
            <p style={{ fontWeight: 800, color: C.text, fontSize: 16 }}>No alerts found</p>
            <p style={{ fontSize: 13, color: C.muted, maxWidth: 360, margin: 0 }}>Sourcing channels are reporting healthy. Anomaly checks are running in background.</p>
          </div>
        )}

        {fetchState === 'success' && alerts.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: C.bg, borderBottom: `1.5px solid ${C.divider}` }}>
                  <th style={{ width: 24, padding: '12px 20px' }} />
                  {['MPN', 'Summary', 'Action Recommendation', 'Urgency', 'Time', 'Action', ''].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: C.muted, letterSpacing: '1px', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: '48px 20px', textAlign: 'center', fontSize: 13, color: C.muted }}>No alerts match your filter criteria.</td></tr>
                ) : filtered.map(alert => (
                  <tr key={alert.id} onClick={() => { if (!alert.is_read) markRead(alert.id, true) }}
                    style={{ borderBottom: `1px solid ${C.divider}`, opacity: alert.is_read ? 0.55 : 1, cursor: 'pointer', transition: 'background 0.12s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = C.rowHover}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                    <td style={{ padding: '12px 20px' }}>{!alert.is_read && <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.green, boxShadow: `0 0 4px ${C.green}` }} />}</td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: C.text }}>{alert.mpn}</td>
                    <td style={{ padding: '12px 16px', maxWidth: 220 }}><p style={{ margin: 0, fontSize: 13, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={alert.summary}>{alert.summary}</p></td>
                    <td style={{ padding: '12px 16px', maxWidth: 200 }}><p style={{ margin: 0, fontSize: 12.5, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={alert.recommendation}>{alert.recommendation}</p></td>
                    <td style={{ padding: '12px 16px' }}><UrgencyBadge urgency={alert.urgency} /></td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: C.mutedLight, whiteSpace: 'nowrap', fontWeight: 600 }}>{relativeTime(alert.created_at)}</td>
                    <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                      <button disabled={mutatingId === alert.id} onClick={() => markRead(alert.id, !alert.is_read)}
                        className="shadow-neu-raised-sm"
                        style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.cardBorder}`, background: C.card, cursor: 'pointer', color: alert.is_read ? C.muted : C.green }}>
                        {mutatingId === alert.id ? <Loader2 size={14} className="animate-spin" /> : alert.is_read ? <BellOff size={14} /> : <Check size={14} />}
                      </button>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      <button disabled={mutatingId === alert.id} onClick={() => deleteAlert(alert.id)}
                        className="shadow-neu-raised-sm"
                        style={{ width: 30, height: 30, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${C.cardBorder}`, background: C.card, cursor: 'pointer', color: C.muted }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.dangerSoft; (e.currentTarget as HTMLElement).style.color = C.danger }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.card; (e.currentTarget as HTMLElement).style.color = C.muted }}>
                        {mutatingId === alert.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
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
