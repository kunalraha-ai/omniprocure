'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, AlertCircle, Zap, Plus, Trash2, Loader2, Eye } from 'lucide-react'
import { supabase } from '@/lib/supabase'

function StatsCard({ label, value, icon, subtitle }: {
  label: string; value: string | number; icon: React.ReactNode; subtitle?: string
}) {
  return (
    <div className="glass-panel rounded-3xl p-6 hover:border-slate-600/60 transition-colors">
      <div className="flex items-start justify-between mb-4"><div>{icon}</div></div>
      <p className="text-xs uppercase tracking-[0.24em] text-on-surface-variant mb-2">{label}</p>
      <p className="text-3xl font-semibold text-on-surface mb-1">{value}</p>
      {subtitle && <p className="text-xs text-on-surface-variant">{subtitle}</p>}
    </div>
  )
}

// ── Watchlist Card ─────────────────────────────────────────────────────────────
function WatchlistCard() {
  const [items, setItems]       = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [input, setInput]       = useState('')
  const [adding, setAdding]     = useState(false)
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
    if (!error) {
      setInput('')
      await fetchWatchlist()
    }
    setAdding(false)
  }

  async function removeItem(mpn: string, id: string) {
    setRemovingId(id)
    await supabase.from('watchlist').delete().eq('mpn', mpn)
    setItems(prev => prev.filter(i => i.id !== id))
    setRemovingId(null)
  }

  return (
    <div className="glass-panel rounded-3xl border-slate-700/60 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-700/70 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4" style={{ color: '#7dd3fc' }} />
          <h2 className="text-base font-semibold text-on-surface">Watchlist</h2>
          {!loading && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: 'rgba(125,211,252,0.1)', color: '#7dd3fc', border: '1px solid rgba(125,211,252,0.2)' }}>
              {items.length}
            </span>
          )}
        </div>
        <span className="text-xs text-on-surface-variant">Manually tracked MPNs</span>
      </div>

      {/* Add input */}
      <div className="px-6 py-4 border-b border-slate-700/40">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addItem()}
            placeholder="Add MPN e.g. ESP32-WROOM-32"
            className="flex-1 bg-transparent text-sm outline-none px-3 py-2 rounded-xl"
            style={{
              background: 'rgba(15,21,36,0.6)',
              border: '1px solid rgba(125,211,252,0.15)',
              color: '#e0e8f0',
            }}
          />
          <button
            onClick={addItem}
            disabled={!input.trim() || adding}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background: input.trim() ? 'rgba(125,211,252,0.15)' : 'rgba(125,211,252,0.05)',
              border: '1px solid rgba(125,211,252,0.2)',
              color: input.trim() ? '#7dd3fc' : '#4a6070',
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
        <div className="flex items-center justify-center gap-2 py-10 text-on-surface-variant">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading watchlist…</span>
        </div>
      ) : items.length === 0 ? (
        <div className="py-10 text-center text-sm text-on-surface-variant">
          No items yet — add an MPN above to start watching it.
        </div>
      ) : (
        <div className="divide-y divide-slate-700/40">
          {items.map(item => (
            <div key={item.id}
              className="flex items-center justify-between px-6 py-3 hover:bg-slate-800/20 transition-colors">
              <div className="flex items-center gap-3">
                <span className="w-2 h-2 rounded-full animate-pulse"
                  style={{ background: '#7dd3fc' }} />
                <span className="text-sm font-mono font-medium text-on-surface">{item.mpn}</span>
                {item.label && item.label !== item.mpn && (
                  <span className="text-xs text-on-surface-variant">{item.label}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {item.last_checked_at && (
                  <span className="text-xs text-on-surface-variant hidden sm:block">
                    Checked {new Date(item.last_checked_at).toLocaleDateString()}
                  </span>
                )}
                <button
                  onClick={() => removeItem(item.mpn, item.id)}
                  disabled={removingId === item.id}
                  className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                  style={{ color: '#4a6070' }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.color = '#ff6b6b'
                    ;(e.currentTarget as HTMLElement).style.background = 'rgba(255,107,107,0.08)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.color = '#4a6070'
                    ;(e.currentTarget as HTMLElement).style.background = 'transparent'
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

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [alerts, setAlerts]     = useState<any[]>([])
  const [monitored, setMonitored] = useState<any[]>([])
  const [stats, setStats]       = useState({ monitored: 0, activeAlerts: 0, apiCalls: 0 })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)

        const { data: alertsData } = await supabase
          .from('alerts').select('*')
          .order('created_at', { ascending: false }).limit(5)

        const { data: monitoredData } = await supabase
          .from('monitored_parts').select('*')
          .order('created_at', { ascending: false }).limit(5)

        const { count: partsCount } = await supabase
          .from('monitored_parts').select('*', { count: 'exact', head: true })

        const { count: alertCount } = await supabase
          .from('alerts').select('*', { count: 'exact', head: true }).eq('is_read', false)

        const today = new Date().toISOString().split('T')[0]
        const { count: apiCallCount } = await supabase
          .from('api_call_log').select('*', { count: 'exact', head: true }).gte('called_at', today)

        setAlerts(alertsData || [])
        setMonitored(monitoredData || [])
        setStats({
          monitored: partsCount || 0,
          activeAlerts: alertCount || 0,
          apiCalls: apiCallCount || 0,
        })
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
      <h1 className="text-3xl font-bold text-on-surface mb-2">Dashboard</h1>
      <p className="text-on-surface-variant">Loading procurement overview...</p>
    </div>
  )

  if (error) return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-on-surface mb-4">Dashboard</h1>
      <div className="glass-panel rounded-3xl border-red-500/20 bg-red-500/10 p-4">
        <p className="text-red-300">{error}</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="glass-panel-elevated rounded-[2rem] border-slate-700/70 p-8">
        <h1 className="text-3xl font-bold text-on-surface mb-1">Dashboard</h1>
        <p className="text-on-surface-variant">Welcome back! Here's your procurement overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatsCard
          label="Monitored Components"
          value={stats.monitored}
          icon={<Zap className="w-5 h-5 text-indigo-400" />}
          subtitle="Across all BOMs"
        />
        <StatsCard
          label="Active Alerts"
          value={stats.activeAlerts}
          icon={<AlertCircle className="w-5 h-5 text-orange-400" />}
          subtitle="Requires action"
        />
        <StatsCard
          label="API Calls Today"
          value={stats.apiCalls}
          icon={<Zap className="w-5 h-5 text-purple-400" />}
          subtitle="Calls this session"
        />
      </div>

      {/* Watchlist + Recent Alerts side by side on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Watchlist */}
        <WatchlistCard />

        {/* Recent Alerts */}
        <div className="glass-panel rounded-3xl border-slate-700/60 overflow-hidden">
          <div className="p-6 border-b border-slate-700/70 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-orange-400" />
            <h2 className="text-base font-semibold text-on-surface">Recent Alerts</h2>
          </div>
          {alerts.length === 0 ? (
            <div className="p-8 text-center text-on-surface-variant text-sm">
              No alerts yet — OmniProcure will notify you when stock or price issues are detected.
            </div>
          ) : (
            <div className="divide-y divide-slate-700/50">
              {alerts.map((alert) => (
                <div key={alert.id} className="px-6 py-4 hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-mono font-medium text-on-surface">{alert.mpn}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          alert.urgency === 'high' ? 'bg-red-500/15 text-red-300'
                          : alert.urgency === 'medium' ? 'bg-orange-500/15 text-orange-300'
                          : 'bg-yellow-500/15 text-yellow-300'
                        }`}>
                          {alert.urgency === 'high' && <AlertTriangle size={10} />}
                          {alert.urgency}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant truncate">{alert.summary}</p>
                    </div>
                    <span className="text-xs text-on-surface-variant whitespace-nowrap flex-shrink-0">
                      {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Monitored Components */}
      <div className="glass-panel rounded-3xl border-slate-700/60 overflow-hidden">
        <div className="p-6 border-b border-slate-700/70">
          <h2 className="text-base font-semibold text-on-surface">Monitored Components</h2>
        </div>
        {monitored.length === 0 ? (
          <div className="p-8 text-center text-on-surface-variant text-sm">
            No components monitored yet —{' '}
            <a href="/dashboard/bom" className="text-primary hover:underline">upload a BOM to get started</a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-950/80">
                <tr>
                  {['MPN', 'Part Name', 'Quantity', 'Status'].map(h => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-[0.16em]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {monitored.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 text-sm font-mono font-medium text-on-surface">{item.mpn}</td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{item.part_name}</td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{item.quantity}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        item.is_active ? 'bg-green-500/15 text-green-300' : 'bg-slate-700/50 text-on-surface-variant'
                      }`}>
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