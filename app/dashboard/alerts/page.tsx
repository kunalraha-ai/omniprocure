'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  AlertTriangle, AlertCircle, Bell, BellOff, RefreshCw,
  Search, Loader2, Trash2, Check, CheckCheck
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
    high:   { cls: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',         Icon: AlertTriangle, label: 'High' },
    medium: { cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400', Icon: AlertCircle,  label: 'Medium' },
    low:    { cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400', Icon: AlertCircle,  label: 'Low' },
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
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [fetchState, setFetchState] = useState<FetchState>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<TabFilter>('all')
  const [mutatingId, setMutatingId] = useState<string | null>(null)
  const [markingAll, setMarkingAll] = useState(false)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchAlerts = useCallback(async () => {
    setFetchState('loading')
    setErrorMessage('')

    const { data, error } = await supabase
      .from('alerts')
      .select('id, mpn, urgency, summary, recommendation, is_read, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      setErrorMessage(error.message)
      setFetchState('error')
      return
    }

    setAlerts(data ?? [])
    setFetchState('success')
  }, [])

  useEffect(() => { fetchAlerts() }, [fetchAlerts])

  // ── Mark as read ───────────────────────────────────────────────────────────

  async function markRead(id: string) {
    setMutatingId(id)
    const { error } = await supabase
      .from('alerts')
      .update({ is_read: true })
      .eq('id', id)

    if (!error) {
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a))
    }
    setMutatingId(null)
  }

  async function markAllRead() {
    setMarkingAll(true)
    const unreadIds = alerts.filter(a => !a.is_read).map(a => a.id)
    if (unreadIds.length === 0) { setMarkingAll(false); return }

    const { error } = await supabase
      .from('alerts')
      .update({ is_read: true })
      .in('id', unreadIds)

    if (!error) {
      setAlerts(prev => prev.map(a => ({ ...a, is_read: true })))
    }
    setMarkingAll(false)
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function deleteAlert(id: string) {
    setMutatingId(id)
    const { error } = await supabase
      .from('alerts')
      .delete()
      .eq('id', id)

    if (!error) {
      setAlerts(prev => prev.filter(a => a.id !== id))
    }
    setMutatingId(null)
  }

  // ── Filter ─────────────────────────────────────────────────────────────────

  const filtered = alerts.filter(a => {
    const q = searchTerm.toLowerCase()
    const matchesSearch = a.mpn.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q)
    const matchesTab =
      activeTab === 'all'    ? true :
      activeTab === 'unread' ? !a.is_read :
      a.urgency === activeTab
    return matchesSearch && matchesTab
  })

  const tabCount = (tab: TabFilter) => {
    if (tab === 'all')    return alerts.length
    if (tab === 'unread') return alerts.filter(a => !a.is_read).length
    return alerts.filter(a => a.urgency === tab).length
  }

  const unreadCount  = alerts.filter(a => !a.is_read).length
  const highCount    = alerts.filter(a => a.urgency === 'high' && !a.is_read).length
  const isLoading    = fetchState === 'loading'

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">Alerts</h1>
            {unreadCount > 0 && (
              <Badge className="bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 text-sm px-2">
                {unreadCount} unread
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            Review supply chain alerts and take action on critical issues.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <Button
            variant="outline"
            size="sm"
            onClick={markAllRead}
            disabled={isLoading || markingAll || unreadCount === 0}
            className="gap-2"
          >
            {markingAll
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <CheckCheck className="w-4 h-4" />
            }
            Mark all read
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAlerts}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">High Priority Unread</p>
                <p className="text-2xl font-bold text-foreground">{isLoading ? '—' : highCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                <Bell className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Unread Alerts</p>
                <p className="text-2xl font-bold text-foreground">{isLoading ? '—' : unreadCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <AlertCircle className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Alerts</p>
                <p className="text-2xl font-bold text-foreground">{isLoading ? '—' : alerts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
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
                  inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium
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

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search MPN or summary…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
            disabled={isLoading}
          />
        </div>
      </div>

      {/* ── Table Card ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Active Alerts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading alerts…</span>
            </div>
          )}

          {/* Error */}
          {fetchState === 'error' && (
            <div className="flex flex-col items-center gap-3 py-16 px-6 text-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
              <p className="font-medium text-foreground">Failed to load alerts</p>
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
              <Button variant="outline" size="sm" onClick={fetchAlerts}>Try again</Button>
            </div>
          )}

          {/* Empty */}
          {fetchState === 'success' && alerts.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 px-6 text-center">
              <div className="p-3 bg-muted rounded-full">
                <Bell className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground">No alerts yet.</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                OmniProcure will notify you here when price changes or stock issues are detected.
              </p>
            </div>
          )}

          {/* Table */}
          {fetchState === 'success' && alerts.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
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
                      <TableCell colSpan={8} className="text-center py-10 text-muted-foreground text-sm">
                        No alerts match your filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map(alert => (
                      <TableRow
                        key={alert.id}
                        className={`cursor-pointer transition-opacity ${alert.is_read ? 'opacity-50' : ''}`}
                        onClick={() => { if (!alert.is_read) markRead(alert.id) }}
                      >
                        {/* Unread dot */}
                        <TableCell className="pl-6 pr-0">
                          {!alert.is_read && (
                            <div className="w-2 h-2 rounded-full bg-blue-500 mt-0.5" />
                          )}
                        </TableCell>

                        <TableCell className="font-mono text-sm font-medium">
                          {alert.mpn}
                        </TableCell>

                        <TableCell className="max-w-[200px]">
                          <p className="truncate text-foreground" title={alert.summary}>
                            {alert.summary}
                          </p>
                        </TableCell>

                        <TableCell className="max-w-xs">
                          <p className="text-sm text-muted-foreground truncate" title={alert.recommendation}>
                            {alert.recommendation}
                          </p>
                        </TableCell>

                        <TableCell>
                          <UrgencyBadge urgency={alert.urgency} />
                        </TableCell>

                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {relativeTime(alert.created_at)}
                        </TableCell>

                        <TableCell onClick={e => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={mutatingId === alert.id}
                            title={alert.is_read ? 'Mark unread' : 'Mark read'}
                            onClick={async () => {
                              setMutatingId(alert.id)
                              const { error } = await supabase
                                .from('alerts')
                                .update({ is_read: !alert.is_read })
                                .eq('id', alert.id)
                              if (!error) {
                                setAlerts(prev => prev.map(a =>
                                  a.id === alert.id ? { ...a, is_read: !a.is_read } : a
                                ))
                              }
                              setMutatingId(null)
                            }}
                          >
                            {mutatingId === alert.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : alert.is_read
                                ? <BellOff className="w-4 h-4 text-muted-foreground" />
                                : <Check className="w-4 h-4 text-blue-500" />
                            }
                          </Button>
                        </TableCell>

                        <TableCell className="text-right pr-4" onClick={e => e.stopPropagation()}>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 hover:text-destructive"
                                disabled={mutatingId === alert.id}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete alert?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This alert for <span className="font-mono font-medium">{alert.mpn}</span> will
                                  be permanently deleted.
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
        </CardContent>
      </Card>
    </div>
  )
}