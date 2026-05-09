'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle, AlertCircle, Bell, BellOff, RefreshCw,
  Search, Loader2, Trash2, Check, CheckCheck
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type Urgency = 'high' | 'medium' | 'low'

interface Alert {
  id: string
  mpn: string
  urgency: Urgency
  summary: string
  recommendation: string
  is_read: boolean
  created_at: string
}

type FetchState = 'idle' | 'loading' | 'success' | 'error'
type TabFilter = 'all' | Urgency | 'unread'

const TABS: { value: TabFilter; label: string }[] = [
  { value: 'all',    label: 'All' },
  { value: 'high',   label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low',    label: 'Low' },
  { value: 'unread', label: 'Unread' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)  return 'just now'
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days  < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function UrgencyBadge({ urgency }: { urgency: Urgency }) {
  const map: Record<Urgency, { cls: string; Icon: React.ElementType; label: string }> = {
    high:   { cls: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',            Icon: AlertTriangle, label: 'High'   },
    medium: { cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400', Icon: AlertCircle,  label: 'Medium' },
    low:    { cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400', Icon: AlertCircle,  label: 'Low'    },
  }
  const { cls, Icon, label } = map[urgency] ?? map.low
  return (
    <Badge className={`gap-1 ${cls}`}>
      <Icon className="w-3 h-3" />
      {label}
    </Badge>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardAlertsPage() {
  const [alerts, setAlerts]         = useState<Alert[]>([])
  const [fetchState, setFetchState] = useState<FetchState>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab]   = useState<TabFilter>('all')
  const [mutatingId, setMutatingId] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)

  const fetchAlerts = useCallback(async () => {
    setFetchState('loading')
    setErrorMessage('')
    const { data, error } = await supabase
      .from('alerts')
      .select('id, mpn, urgency, summary, recommendation, is_read, created_at')
      .order('created_at', { ascending: false })
    if (error) { setErrorMessage(error.message); setFetchState('error'); return }
    setAlerts(data ?? [])
    setFetchState('success')
  }, [])

  useEffect(() => { fetchAlerts() }, [fetchAlerts])

  async function markRead(id: string, value: boolean) {
    setMutatingId(id)
    const { error } = await supabase.from('alerts').update({ is_read: value }).eq('id', id)
    if (!error) setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: value } : a))
    setMutatingId(null)
  }

  async function markAllRead() {
    setMarkingAll(true)
    const ids = alerts.filter(a => !a.is_read).map(a => a.id)
    if (!ids.length) { setMarkingAll(false); return }
    const { error } = await supabase.from('alerts').update({ is_read: true }).in('id', ids)
    if (!error) setAlerts(prev => prev.map(a => ({ ...a, is_read: true })))
    setMarkingAll(false)
  }

  async function deleteAlert(id: string) {
    setMutatingId(id)
    const { error } = await supabase.from('alerts').delete().eq('id', id)
    if (!error) setAlerts(prev => prev.filter(a => a.id !== id))
    setMutatingId(null)
  }

  const filtered = alerts.filter(a => {
    const q = searchTerm.toLowerCase()
    const matchesSearch = a.mpn.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q)
    const matchesTab =
      activeTab === 'all'    ? true :
      activeTab === 'unread' ? !a.is_read :
      a.urgency === activeTab
    return matchesSearch && matchesTab
  })

  const tabCount = (tab: TabFilter) =>
    tab === 'all'    ? alerts.length :
    tab === 'unread' ? alerts.filter(a => !a.is_read).length :
    alerts.filter(a => a.urgency === tab).length

  const unreadCount = alerts.filter(a => !a.is_read).length
  const highCount   = alerts.filter(a => a.urgency === 'high' && !a.is_read).length
  const isLoading   = fetchState === 'loading'

  return (
    <div className="space-y-6">

      {/* ── Header (matches BOM elevated panel) ── */}
      <div className="glass-panel-elevated rounded-[2rem] border-slate-700/70 p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl space-y-4">
            <span className="inline-flex rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              Supply Chain Monitor
            </span>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-on-surface">Alerts</h1>
                {unreadCount > 0 && (
                  <Badge className="bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 text-sm px-2">
                    {unreadCount} unread
                  </Badge>
                )}
              </div>
              <p className="mt-2 text-sm text-on-surface-variant">
                Review supply chain alerts and take action on critical issues.
              </p>
            </div>
          </div>

          {/* Stat mini-cards (matches BOM's 3-col header stats) */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="glass-panel rounded-3xl p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-on-surface-variant">High Priority</p>
              <p className="mt-3 text-2xl font-semibold text-on-surface">
                {isLoading ? '—' : highCount}
              </p>
            </div>
            <div className="glass-panel rounded-3xl p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-on-surface-variant">Unread</p>
              <p className="mt-3 text-2xl font-semibold text-on-surface">
                {isLoading ? '—' : unreadCount}
              </p>
            </div>
            <div className="glass-panel rounded-3xl p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-on-surface-variant">Total Alerts</p>
              <p className="mt-3 text-2xl font-semibold text-on-surface">
                {isLoading ? '—' : alerts.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs + Search ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 flex-wrap">
          {TABS.map(tab => {
            const count = tabCount(tab.value)
            const isActive = activeTab === tab.value
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                disabled={isLoading}
                className={`
                  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
                  transition-colors border
                  ${isActive
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-transparent text-muted-foreground border-border hover:text-foreground hover:border-foreground/30'
                  }
                `}
              >
                {tab.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${isActive ? 'bg-background/20' : 'bg-muted'}`}>
                  {isLoading ? '—' : count}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={markAllRead}
            disabled={isLoading || markingAll || unreadCount === 0}
            className="gap-2 rounded-3xl"
          >
            {markingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCheck className="w-4 h-4" />}
            Mark all read
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAlerts}
            disabled={isLoading}
            className="gap-2 rounded-3xl"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Search bar ── */}
      <div className="relative w-full sm:w-72">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
        <Input
          placeholder="Search MPN or summary…"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          disabled={isLoading}
          className="pl-9 rounded-3xl glass-input text-on-surface"
        />
      </div>

      {/* ── Alerts table (matches BOM results card style) ── */}
      <div className="glass-panel rounded-3xl border-slate-700/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700/70">
          <h2 className="text-base font-semibold text-on-surface flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Active Alerts
          </h2>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center gap-3 py-16 text-on-surface-variant">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading alerts…</span>
          </div>
        )}

        {/* Error */}
        {fetchState === 'error' && (
          <div className="flex flex-col items-center gap-3 py-16 px-6 text-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
            <p className="font-medium text-on-surface">Failed to load alerts</p>
            <p className="text-sm text-on-surface-variant">{errorMessage}</p>
            <Button variant="outline" size="sm" onClick={fetchAlerts} className="rounded-3xl">Try again</Button>
          </div>
        )}

        {/* Empty */}
        {fetchState === 'success' && alerts.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 px-6 text-center">
            <div className="p-3 rounded-full border border-slate-700/80 bg-slate-950/60">
              <Bell className="w-6 h-6 text-on-surface-variant" />
            </div>
            <p className="font-medium text-on-surface">No alerts yet.</p>
            <p className="text-sm text-on-surface-variant max-w-sm">
              OmniProcure will notify you here when price changes or stock issues are detected.
            </p>
          </div>
        )}

        {/* Table */}
        {fetchState === 'success' && alerts.length > 0 && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-950/80">
                  <TableHead className="w-4 pl-6" />
                  <TableHead>MPN</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead className="max-w-xs">Recommendation</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead>Read</TableHead>
                  <TableHead className="w-20 text-right pr-4">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-10 text-on-surface-variant text-sm">
                      No alerts match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(alert => (
                    <TableRow
                      key={alert.id}
                      className={`cursor-pointer transition-opacity ${alert.is_read ? 'opacity-50' : ''}`}
                      onClick={() => { if (!alert.is_read) markRead(alert.id, true) }}
                    >
                      <TableCell className="pl-6 pr-0">
                        {!alert.is_read && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                      </TableCell>
                      <TableCell className="font-mono text-sm font-medium text-on-surface">{alert.mpn}</TableCell>
                      <TableCell className="max-w-[200px]">
                        <p className="truncate text-on-surface" title={alert.summary}>{alert.summary}</p>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="text-sm text-on-surface-variant truncate" title={alert.recommendation}>{alert.recommendation}</p>
                      </TableCell>
                      <TableCell><UrgencyBadge urgency={alert.urgency} /></TableCell>
                      <TableCell className="text-on-surface-variant text-sm whitespace-nowrap">{relativeTime(alert.created_at)}</TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8"
                          disabled={mutatingId === alert.id}
                          onClick={() => markRead(alert.id, !alert.is_read)}
                        >
                          {mutatingId === alert.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : alert.is_read
                              ? <BellOff className="w-4 h-4 text-on-surface-variant" />
                              : <Check className="w-4 h-4 text-blue-500" />
                          }
                        </Button>
                      </TableCell>
                      <TableCell className="text-right pr-4" onClick={e => e.stopPropagation()}>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" disabled={mutatingId === alert.id}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete alert?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This alert for <span className="font-mono font-medium">{alert.mpn}</span> will be permanently deleted.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => deleteAlert(alert.id)}
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}