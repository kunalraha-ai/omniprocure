'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, AlertCircle, ShoppingCart, Zap, TrendingUp, TrendingDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'

function StatsCard({
  label,
  value,
  icon,
  trend,
  subtitle,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  trend?: 'up' | 'down'
  subtitle?: string
}) {
  return (
    <div className="p-6 rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>{icon}</div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend === 'up' ? 'text-green-600' : 'text-gray-400'}`}>
            {trend === 'up' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {trend === 'up' ? '+12%' : '-4%'}
          </div>
        )}
      </div>
      <p className="text-gray-500 text-sm font-medium mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{value}</p>
      {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
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
          .eq('status', 'pending')

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
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="text-gray-500">Loading procurement overview...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">Dashboard</h1>
        <p className="text-gray-500">Welcome back! Here's your procurement overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard
          label="Monitored Components"
          value={stats.monitored}
          icon={<Zap className="w-5 h-5 text-indigo-500" />}
          trend="up"
          subtitle="Across all BOMs"
        />
        <StatsCard
          label="Active Alerts"
          value={stats.activeAlerts}
          icon={<AlertCircle className="w-5 h-5 text-orange-500" />}
          trend="down"
          subtitle="Requires action"
        />
        <StatsCard
          label="Pending POs"
          value={stats.pendingPOs}
          icon={<ShoppingCart className="w-5 h-5 text-blue-500" />}
          subtitle="Awaiting approval"
        />
        <StatsCard
          label="API Calls Today"
          value={`${stats.apiCalls}/100`}
          icon={<Zap className="w-5 h-5 text-purple-500" />}
          subtitle="Daily limit"
        />
      </div>

      {/* Recent Alerts */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold">Recent Alerts</h2>
        </div>
        {alerts.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No alerts yet — OmniProcure will notify you when stock or price issues are detected.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">MPN</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Summary</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Urgency</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {alerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium">{alert.mpn}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{alert.summary}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        alert.urgency === 'high'
                          ? 'bg-red-100 text-red-700'
                          : alert.urgency === 'medium'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {alert.urgency === 'high' && <AlertTriangle size={12} />}
                        {alert.urgency}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
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
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="p-6 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold">Monitored Components</h2>
        </div>
        {monitored.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            No components monitored yet —{' '}
            <a href="/dashboard/bom" className="text-indigo-600 hover:underline">
              upload a BOM to get started
            </a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">MPN</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Part Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {monitored.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium">{item.mpn}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{item.part_name}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{item.quantity}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        item.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
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