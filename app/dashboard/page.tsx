'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, AlertCircle, ShoppingCart, Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'

function StatsCard({
  label,
  value,
  icon,
  subtitle,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  subtitle?: string
}) {
  return (
    <div className="glass-panel rounded-3xl p-6 hover:border-slate-600/60 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div>{icon}</div>
      </div>
      <p className="text-xs uppercase tracking-[0.24em] text-on-surface-variant mb-2">{label}</p>
      <p className="text-3xl font-semibold text-on-surface mb-1">{value}</p>
      {subtitle && <p className="text-xs text-on-surface-variant">{subtitle}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const [alerts, setAlerts] = useState<any[]>([])
  const [monitored, setMonitored] = useState<any[]>([])
  const [stats, setStats] = useState({
    monitored: 0,
    activeAlerts: 0,
    pendingPOs: 0,
    apiCalls: 0
  })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)

        const { data: alertsData } = await supabase
          .from('alerts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5)

        const { data: monitoredData } = await supabase
          .from('monitored_parts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(5)

        const { count: partsCount } = await supabase
          .from('monitored_parts')
          .select('*', { count: 'exact', head: true })

        const { count: alertCount } = await supabase
          .from('alerts')
          .select('*', { count: 'exact', head: true })
          .eq('is_read', false)

        const { count: ordersCount } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending_review')

        const { data: apiData } = await supabase
          .from('api_usage')
          .select('calls_today')
          .limit(1)
          .maybeSingle()

        setAlerts(alertsData || [])
        setMonitored(monitoredData || [])
        setStats({
          monitored: partsCount || 0,
          activeAlerts: alertCount || 0,
          pendingPOs: ordersCount || 0,
          apiCalls: apiData?.calls_today || 0
        })
      } catch (err) {
        setError('Failed to load dashboard data')
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  if (isLoading) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold text-on-surface mb-2">Dashboard</h1>
        <p className="text-on-surface-variant">Loading procurement overview...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold text-on-surface mb-4">Dashboard</h1>
        <div className="glass-panel rounded-3xl border-red-500/20 bg-red-500/10 p-4">
          <p className="text-red-300">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="glass-panel-elevated rounded-[2rem] border-slate-700/70 p-8">
        <h1 className="text-3xl font-bold text-on-surface mb-1">Dashboard</h1>
        <p className="text-on-surface-variant">Welcome back! Here's your procurement overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
          label="Pending POs"
          value={stats.pendingPOs}
          icon={<ShoppingCart className="w-5 h-5 text-blue-400" />}
          subtitle="Awaiting approval"
        />
        <StatsCard
          label="API Calls Today"
          value={stats.apiCalls}
          icon={<Zap className="w-5 h-5 text-purple-400" />}
          subtitle="Calls this session"
        />
      </div>

      {/* Recent Alerts */}
      <div className="glass-panel rounded-3xl border-slate-700/60 overflow-hidden">
        <div className="p-6 border-b border-slate-700/70">
          <h2 className="text-base font-semibold text-on-surface">Recent Alerts</h2>
        </div>
        {alerts.length === 0 ? (
          <div className="p-8 text-center text-on-surface-variant">
            No alerts yet — OmniProcure will notify you when stock or price issues are detected.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-950/80">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-[0.16em]">MPN</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-[0.16em]">Summary</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-[0.16em]">Urgency</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-[0.16em]">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {alerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-on-surface">{alert.mpn}</td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{alert.summary}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        alert.urgency === 'high'
                          ? 'bg-red-500/15 text-red-300'
                          : alert.urgency === 'medium'
                          ? 'bg-orange-500/15 text-orange-300'
                          : 'bg-yellow-500/15 text-yellow-300'
                      }`}>
                        {alert.urgency === 'high' && <AlertTriangle size={12} />}
                        {alert.urgency}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">
                      {new Date(alert.created_at).toLocaleTimeString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Monitored Components */}
      <div className="glass-panel rounded-3xl border-slate-700/60 overflow-hidden">
        <div className="p-6 border-b border-slate-700/70">
          <h2 className="text-base font-semibold text-on-surface">Monitored Components</h2>
        </div>
        {monitored.length === 0 ? (
          <div className="p-8 text-center text-on-surface-variant">
            No components monitored yet —{' '}
            <a href="/dashboard/bom" className="text-primary hover:underline">
              upload a BOM to get started
            </a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-950/80">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-[0.16em]">MPN</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-[0.16em]">Part Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-[0.16em]">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-on-surface-variant uppercase tracking-[0.16em]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {monitored.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-on-surface">{item.mpn}</td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{item.part_name}</td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{item.quantity}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        item.is_active
                          ? 'bg-green-500/15 text-green-300'
                          : 'bg-slate-700/50 text-on-surface-variant'
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